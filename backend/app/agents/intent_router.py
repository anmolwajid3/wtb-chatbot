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
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import get_agent_prompt


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
marked is_off_topic=true, not treated as a normal coaching-related message."""


def run_intent_router(state: dict) -> dict:
    state["outcome"] = "in_progress"  # reset each turn — don't let a prior turn's outcome (e.g. "spam") stick around
    state["safety_loop_count"] = 0
    state["safety_fallback_used"] = False
    state["off_topic_this_turn"] = False

    llm = get_llm(temperature=0.0, agent_name="intent_router")
    structured_llm = llm.with_structured_output(IntakeExtraction)

    latest_message = state["messages"][-1]["content"]
    system_prompt = get_agent_prompt("intent_router", INTAKE_SYSTEM_PROMPT_DEFAULT)
    result: IntakeExtraction = structured_llm.invoke(
        [
            {"role": "system","content": system_prompt},
            {"role": "user", "content": latest_message},
        ]
    )

    if result.is_spam:
        state["outcome"] = "spam"
        return state

    state["off_topic_this_turn"] = result.is_off_topic

    # Merge without overwriting already-known fields
    slots = state.get("gathered_slots", {})
    if result.theme and not slots.get("theme"):
        slots["theme"] = result.theme
    if result.timing and not slots.get("timing"):
        slots["timing"] = result.timing
    if result.budget and not slots.get("budget"):
        slots["budget"] = result.budget
    if result.group_size and not slots.get("group_size"):
        slots["group_size"] = result.group_size
    if result.need_description:
        # need_description can accumulate/update each turn since it's free text
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
    state["ready_to_match"] = has_core_fields and state["turn_count"] >= 2

    return state