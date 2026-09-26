"""
Intent Router / Intake Agent.

Responsibilities (per blueprint Section 5.1):
- Screen for spam/irrelevant messages.
- Extract theme, timing, budget (optional), group_size (optional), and a
  free-text need description from the visitor's message.
- Merge newly-extracted fields into state without overwriting fields already
  gathered in earlier turns.
- Decide whether the conversation has been "warmed up" enough to proceed to
  matching — the bot must NOT recommend on the very first message.
"""
import re
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.agents.guardrail_check import visitor_advice_rule
from app.db.connection import fetch_match_settings, get_agent_prompt


class IntakeExtraction(BaseModel):
    is_spam: bool = Field(
        description="True only for genuinely abusive, promotional, or malicious content unrelated to any "
                    "real conversation. Never true for polite conversational closings, greetings, thank-yous, "
                    "or farewells (e.g. 'thanks', 'have a good day', 'bye') — these are normal and should pass through."
    )
    is_off_topic: bool = Field(
        default=False,
        description="True if the latest message is a legitimate but unrelated personal aside — e.g. "
                    "mentioning a personal event, a typo, small talk — that has nothing to do with the "
                    "coaching conversation. This is DIFFERENT from spam: it's not malicious or promotional, "
                    "just not relevant. False for anything even loosely connected to their team, work, or "
                    "coaching need. Never true at the same time as is_spam.",
    )
    theme: str | None = Field(default=None, description="The coaching theme/topic, e.g. 'leadership', 'crisis communication', 'team building'")
    timing: str | None = Field(
        default=None,
        description="When the customer wants the coaching/program to START or be delivered "
                    "(e.g. 'next month', 'within 2 weeks', 'no rush'). Do NOT fill this from "
                    "mentions of how long an existing problem has been going on (e.g. 'we've felt "
                    "this way for months') — that describes the problem's duration, not the desired "
                    "timing for the engagement. Leave null unless the customer states an actual "
                    "start/delivery timeframe.",
    )
    budget: str | None = Field(default=None, description="Budget info, only if the visitor volunteered it — this is optional, never ask for it directly")
    group_size: int | None = Field(default=None, description="Number of participants, only if mentioned — optional field")
    need_description: str | None = Field(default=None, description="A free-text summary of what the visitor is looking for")


INTAKE_SYSTEM_PROMPT_DEFAULT = """You are the intake-parsing component of a coaching-company chatbot. Your ONLY job is structured extraction — you do not write any reply to the user. Extract what you can from the latest message. Do not invent information that wasn't stated. Leave fields null if not mentioned. Budget and group size are optional signals the visitor may or may not share unprompted — never treat their absence as a problem.

Only mark is_spam=true for genuinely abusive, promotional, or malicious content.
Do NOT mark polite closings, greetings, thank-yous, or farewells as spam, even
though they don't mention coaching — these are a normal, expected part of
finishing a conversation.

Actively check for is_off_topic=true: this applies whenever the latest message
is a genuine personal aside unrelated to coaching — mentioning a personal loss,
an unrelated life event, or anything purely conversational rather than about
their team or work situation. This is common and expected; do not default to
false just because the message isn't spam. Example: "my cat died" should be
marked is_off_topic=true, not treated as a normal coaching-related message.
A request for medical or legal advice is not a coaching need. Set is_off_topic=true
and leave theme, timing, and need_description null."""


def _clean_message(text: str) -> str:
    return text.strip().strip("*_\"'").strip()


def _price_question_text(text: str) -> bool:
    return bool(re.search(r"\b(price|pricing|cost|how much|fee|fees)\b", text, re.I))


def _timing_phrase(text: str) -> str | None:
    """The start window, preferring a real period over a vague 'no rush'."""
    patterns = (
        r"\b(?:within|in) (?:a|an|the|\d+) (?:day|days|week|weeks|month|months)\b",
        r"\b(?:next month|this month|next week|this week|this quarter)\b",
        r"\b(?:asap|as soon as possible|right away|immediately)\b",
        r"\b(?:no rush|no urgent deadline|soon)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(0)
    return None


def _group_size(text: str) -> int | None:
    match = re.search(
        r"\b(?:about|around|roughly|approximately)?\s*(\d{1,4})\s*(?:people|persons|person|members)\b",
        text,
        re.I,
    )
    return int(match.group(1)) if match else None


def _still_needs_the_agent(text: str, found_timing: str | None, slots: dict) -> bool:
    """A long line can still hide a start date or a headcount the shortcut missed."""
    mentions_time = bool(re.search(r"\b(month|week|day|deadline|start|quarter|asap|soon)\b", text, re.I))
    if mentions_time and not found_timing and not slots.get("timing"):
        return True
    mentions_size = bool(re.search(r"\b(people|person|members)\b", text, re.I))
    if mentions_size and _group_size(text) is None and not slots.get("group_size"):
        return True
    return False


def _looks_like_a_situation(text: str) -> bool:
    """A real description of a need, not a short price question."""
    words = re.findall(r"[A-Za-z']+", text)
    if len(words) < 6:
        return False
    if re.search(r"\b(price|pricing|cost|how much|fee|fees)\b", text, re.I) and len(words) < 14:
        return False
    return True


def run_intent_router(state: dict) -> dict:
    state["outcome"] = "in_progress"  # reset each turn — don't let a prior turn's outcome (e.g. "spam") stick around
    state["safety_loop_count"] = 0
    state["safety_fallback_used"] = False
    state["off_topic_this_turn"] = False
    state["advice_blocked"] = False
    state["guardrail_violated"] = False
    state["guardrail_which_rule"] = None
    state["draft_reply"] = ""
    state["final_reply"] = ""

    latest_message = _clean_message(state["messages"][-1]["content"])
    slots = dict(state.get("gathered_slots", {}))

    # The medical/legal rule applies to what the visitor asked, before any
    # intake shortcut can treat the request as a missing coaching detail.
    blocked_rule = visitor_advice_rule(latest_message, state.get("organization_id"))
    if blocked_rule:
        state["advice_blocked"] = True
        state["off_topic_this_turn"] = True
        state["guardrail_violated"] = True
        state["guardrail_which_rule"] = blocked_rule
        state["gathered_slots"] = slots
        state["turn_count"] = state.get("turn_count", 0) + 1
        state["ready_to_match"] = False
        return state

    found_timing = _timing_phrase(latest_message)
    if found_timing and not slots.get("timing"):
        slots["timing"] = found_timing
    found_size = _group_size(latest_message)
    if found_size and not slots.get("group_size"):
        slots["group_size"] = found_size
    if _looks_like_a_situation(latest_message):
        existing_need = slots.get("need_description") or ""
        if latest_message not in existing_need:
            slots["need_description"] = f"{existing_need} {latest_message}".strip()
        if not slots.get("theme"):
            slots["theme"] = latest_message[:80]

    understood_locally = bool(
        _price_question_text(latest_message) or _looks_like_a_situation(latest_message) or found_timing
    ) and not _still_needs_the_agent(latest_message, found_timing, slots)
    if not understood_locally:
        llm = get_llm(temperature=0.0, agent_name="intent_router", organization_id=state.get("organization_id"))
        structured_llm = llm.with_structured_output(IntakeExtraction)
        recent = "\n".join(
            f"{m['role']}: {_clean_message(m['content'])}" for m in state["messages"][-6:]
        )
        system_prompt = get_agent_prompt("intent_router", INTAKE_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
        system_prompt += (
            "\n\nA description of a team or work problem is both the theme and the need, "
            "even with no date attached. Do not leave theme or need_description empty when "
            "the visitor describes what is going on. A price question by itself fills neither. "
            "A request for medical or legal advice is off topic: set is_off_topic=true and "
            "leave theme, timing, and need_description null."
        )
        result: IntakeExtraction = structured_llm.invoke(
            [
                {"role": "system","content": system_prompt},
                {"role": "user", "content": recent},
            ]
        )

        if result.is_spam:
            state["outcome"] = "spam"
            return state

        state["off_topic_this_turn"] = result.is_off_topic
        if not result.is_off_topic:
            if result.theme and not slots.get("theme"):
                slots["theme"] = result.theme
            if result.timing and not slots.get("timing"):
                slots["timing"] = result.timing
            if result.budget and not slots.get("budget"):
                slots["budget"] = result.budget
            if result.group_size and not slots.get("group_size"):
                slots["group_size"] = result.group_size
            if result.need_description:
                existing = slots.get("need_description", "")
                slots["need_description"] = f"{existing} {result.need_description}".strip()

    state["gathered_slots"] = slots
    state["turn_count"] = state.get("turn_count", 0) + 1

    # Warm-up rule: never recommend on the very first message. Require at
    # least one prior turn AND the core fields — theme, need_description,
    # and timing are all required before matching; budget and group_size
    # stay optional/soft signals per the brief.
    has_core_fields = (
        bool(slots.get("theme"))
        and bool(slots.get("need_description"))
        and bool(slots.get("timing"))
    )
    settings = fetch_match_settings(state.get("organization_id"))
    state["ready_to_match"] = has_core_fields and state["turn_count"] >= settings["followup_turns"]

    return state