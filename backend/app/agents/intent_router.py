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


_PRICE_ASK_RE = re.compile(
    r"(?:"
    r"\b(?:price|pricing|cost|how\s+much|fee|fees)\b"
    r"|\b(?:hinta\w*|hinnoittelu|kustannus\w*)\b"
    r"|\bmaksa(?:a|vat|isi|isit|tte|n|mme)?\b"
    r"|\bpaljonko\b"
    r"|\b(?:pris|kostar|kostnad\w*)\b"
    r")",
    re.I,
)

# Personal grief / loss asides — never a coaching "theme" via the local shortcut.
_PERSONAL_OFF_TOPIC_RE = re.compile(
    r"(?:"
    r"\b(?:my|our)\s+(?:cat|dog|pet|mom|dad|mother|father|grandma|grandpa|"
    r"wife|husband|partner|child|kid|baby)\s+(?:died|passed)\b"
    r"|\b(?:passed\s+away|died\s+unexpectedly)\b"
    r"|(?:kissani|koirani|lemmikkini|äitini|isäni|puolisoni|lapseni)"
    r".{0,40}\b(?:kuoli|kuollut)\b"
    r"|\b(?:kuoli|kuollut)\b.{0,40}"
    r"(?:kissani|koirani|lemmikkini|äitini|isäni|puolisoni|lapseni|"
    r"kissa|koira|lemmikki)\b"
    r")",
    re.I,
)


def _price_question_text(text: str) -> bool:
    return bool(_PRICE_ASK_RE.search(text or ""))


def _is_obvious_off_topic(text: str) -> bool:
    """Cheap screen for personal asides that must not become a coaching theme."""
    return bool(_PERSONAL_OFF_TOPIC_RE.search(text or ""))


def _timing_phrase(text: str) -> str | None:
    """The start window, preferring a real period over a vague 'no rush'."""
    patterns = (
        # English
        r"\b(?:within|in) (?:a|an|the|\d+) (?:day|days|week|weeks|month|months)\b",
        r"\b(?:next month|this month|next week|this week|this quarter)\b",
        r"\b(?:asap|as soon as possible|right away|immediately)\b",
        r"\b(?:no rush|no urgent deadline|soon)\b",
        # Finnish — "noin kuukauden päästä", "ensi kuussa", …
        r"(?:noin\s+)?(?:\d+\s+)?(?:kuukauden|viikon|päivän)\s+päästä",
        r"(?:kuukauden|viikon|päivän)\s+sisällä",
        r"ensi\s+(?:kuussa|viikolla)",
        r"tässä\s+(?:kuussa|viikolla)",
        r"mahdollisimman\s+pian",
        r"\b(?:heti|pian)\b",
        r"ei\s+kiirettä",
        # Swedish
        r"\bom\s+(?:en|ett|\d+)\s+(?:månad|månader|vecka|veckor|dag|dagar)\b",
        r"\bnästa\s+(?:månad|vecka)\b",
        r"\binom\s+(?:en|ett|\d+)\s+(?:månad|månader|vecka|veckor)\b",
        r"\bså\s+snart\s+som\s+möjligt\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(0)
    return None


def _group_size(text: str) -> int | None:
    match = re.search(
        r"\b(?:about|around|roughly|approximately|noin|cirka|ca\.?)?\s*"
        r"(\d{1,4})\s*"
        r"(?:people|persons|person|members|henkilöä|henkiloa|henkilöt|henkilot|personer)\b",
        text,
        re.I,
    )
    return int(match.group(1)) if match else None


def _still_needs_the_agent(text: str, found_timing: str | None, slots: dict) -> bool:
    """A long line can still hide a start date or a headcount the shortcut missed."""
    mentions_time = bool(
        re.search(
            r"\b(month|week|day|deadline|start|quarter|asap|soon|"
            r"kuukaus|kuukauden|viikko|viikon|päivä|päivän|päästä|aloittaa|"
            r"månad|vecka|inom)\b",
            text,
            re.I,
        )
    )
    if mentions_time and not found_timing and not slots.get("timing"):
        return True
    mentions_size = bool(
        re.search(r"\b(people|person|members|henkilöä|henkiloa|henkilöt|personer)\b", text, re.I)
    )
    if mentions_size and _group_size(text) is None and not slots.get("group_size"):
        return True
    return False


def _is_obvious_spam(text: str) -> bool:
    """Cheap promo/abuse screen so spam never becomes a coaching 'theme'."""
    if not text:
        return False
    if re.search(
        r"(?:"
        r"osta\s+nyt|buy\s+now|shop\s+now|order\s+now|"
        r"click\s+here|klikkaa\s+(?:tästä|tasta)|klicka\s+här|"
        r"alennus\s*\d|\d+\s*%\s*(?:off|alennus|rabatt)|"
        r"limited\s+time\s+offer|act\s+now|make\s+money\s+fast|"
        r"crypto\s+invest|viagra|cialis|nigerian\s+prince"
        r")",
        text,
        re.I,
    ):
        return True
    # Promo blasts often mix discounts with shouty punctuation.
    if text.count("!") >= 2 and re.search(
        r"\d+\s*%|alennus|discount|sale|gratis|free\b|rabatt", text, re.I
    ):
        return True
    return False


def _looks_like_a_situation(text: str) -> bool:
    """A real description of a need, not a short price question or promo spam."""
    if _is_obvious_spam(text) or _is_obvious_off_topic(text):
        return False
    # Include Finnish/Swedish letters (ä ö å) so word counts are real.
    words = re.findall(r"[A-Za-zÄÖÅäöå']+", text)
    if len(words) < 6:
        return False
    if _price_question_text(text) and len(words) < 14:
        return False
    return True


def _counts_as_intake_turn(is_price_ask: bool, state: dict) -> bool:
    """True only for a real coaching message that should warm up matching."""
    return (
        not is_price_ask
        and not state.get("off_topic_this_turn")
        and not state.get("advice_blocked")
        and state.get("outcome") != "spam"
    )


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
        # Boundary turns (medical/legal) do NOT count toward warm-up / matching.
        state["ready_to_match"] = False
        return state

    # Promo spam must never become theme/need via the local shortcut.
    if _is_obvious_spam(latest_message):
        state["outcome"] = "spam"
        state["gathered_slots"] = slots
        state["ready_to_match"] = False
        return state

    # Personal grief / loss asides must not become theme via the local shortcut
    # (that path would skip the LLM and never set is_off_topic).
    if _is_obvious_off_topic(latest_message):
        state["off_topic_this_turn"] = True
        state["gathered_slots"] = slots
        state["ready_to_match"] = False
        return state

    # Never treat price or medical/legal asks as the coaching "situation".
    is_price_ask = _price_question_text(latest_message)

    found_timing = _timing_phrase(latest_message)
    if found_timing and not slots.get("timing") and not is_price_ask:
        slots["timing"] = found_timing
    found_size = _group_size(latest_message)
    if found_size and not slots.get("group_size") and not is_price_ask:
        slots["group_size"] = found_size
    # Don't stuff a pure timing answer into need/theme once the situation is known.
    timing_only = bool(found_timing) and bool(slots.get("theme") or slots.get("need_description"))
    if _looks_like_a_situation(latest_message) and not is_price_ask and not timing_only:
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
            # Spam does not count toward warm-up / matching.
            state["ready_to_match"] = False
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
    # turn_count = every non-boundary message that reaches here (analytics only).
    state["turn_count"] = state.get("turn_count", 0) + 1

    # Only real coaching intake turns count toward followup_turns.
    # Spam, medical/legal, off-topic asides, and bare price asks do not.
    if _counts_as_intake_turn(is_price_ask, state):
        state["intake_turn_count"] = state.get("intake_turn_count", 0) + 1

    # Warm-up rule: never recommend on the very first coaching message.
    # Require followup_turns coaching messages AND core fields.
    has_core_fields = (
        bool(slots.get("theme"))
        and bool(slots.get("need_description"))
        and bool(slots.get("timing"))
    )
    settings = fetch_match_settings(state.get("organization_id"))
    state["ready_to_match"] = (
        has_core_fields
        and state.get("intake_turn_count", 0) >= settings["followup_turns"]
    )

    return state
