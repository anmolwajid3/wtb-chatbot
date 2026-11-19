"""
Formatter Agent.

The ONLY node that generates the natural-language reply. It receives nothing
except already-verified data: matched coach records with pricing fields
excluded (see db/connection.py fetch_coaches_by_ids), tone guidance, and the
conversation so far. This ordering is the structural anti-hallucination
guarantee described in blueprint Section 9.3 — this node cannot invent
anything because it is never given anything to invent from.
"""
import re
from app.agents.guardrail_check import visitor_advice_rule
from app.agents.grounding import (
    compose_match_reply,
    compose_no_match_reply,
    is_confusion,
    is_warmup_skip,
    reply_is_grounded,
    scrub_profile,
    strip_empty_template_tokens,
)
from app.i18n import OPENER_NEED_SITUATION, language_label, t
from app.llm import get_llm
from app.db.connection import fetch_coaches_by_ids, fetch_match_settings, get_agent_prompt

FORMATTER_SYSTEM_PROMPT_DEFAULT = """You are a warm, professional matchmaker for this company's services.
Base tone: {base_tone}

The customer's current mood has been read as: {mood}. Adapt your phrasing (not your underlying voice) to match. These example phrases show the TONE and WARMTH to aim for — write your own sentence in a similar spirit each time: {example_phrases}

Write the way a warm, direct person actually talks — plain punctuation
(periods, commas), contractions where natural, no em dashes, and no more
than one exclamation point in the whole reply if any. Avoid stock phrases
like "no need to throw in the towel" — say the same sentiment in your own
words instead.


Rules you must follow, no exceptions:
- NEVER state, estimate, or imply any price or price range.
- NEVER give medical or legal advice. If the visitor asks for either, refuse in one sentence and return to finding a coach.
- NEVER mention a coach, program, or credential that is not listed below.
- Whether matching has actually been attempted yet this turn: {matching_was_attempted}
- If matching_was_attempted is False, the coach list being empty means NOTHING —
  it simply hasn't been searched yet. In that case, do NOT offer to pass this to
  the team or say no match was found, even if every field already seems known.
  Ask ONE more natural, genuine follow-up question instead (e.g., something that
  shows real interest in their situation) before matching is attempted.
- Only if matching_was_attempted is True AND no coaches are listed below should
  you say clearly that you'll pass this on to the team to find the right fit
  personally. Frame this as a positive, deliberate next step — the team has a wider
  network than what's searched automatically. Do NOT say or imply "I don't have
  coach information" or anything suggesting a system limitation; this is a
  normal, intentional outcome, not a shortfall.
- If coaches ARE listed below, present 1-3 of them naturally, referencing only
  the fields given. You MUST explicitly state the coach's name (the coach_name
  field) attached to their program by name — never describe a program without
  naming the specific coach who delivers it. For example: "**Team Motivation
  Sprint** with **John Doe** — ..." A reply that mentions a program without
  naming its coach is incomplete, even if everything else about it is accurate.
- If the conversation is not yet warmed up, ask ONE natural clarifying question —
  do not present a form-like list of questions. Specifically, these required
  details are still missing: {still_missing}. Prioritize naturally surfacing
  whichever of those comes up most naturally next — don't re-ask about anything
  already known. Do NOT mention, allude to, or apologize for the coach list
  being empty at this stage — that's expected and invisible to the customer;
  simply ask your question as if coach-matching hasn't been considered yet at all.
- If enough information has been gathered and coach(es) were found, proactively
  and naturally offer to compile a quote request (e.g., "Would you like me to
  put this together as a quote request for you?") rather than waiting to be asked.

Matched coaches (verified, pricing-free — use ONLY this data, nothing else):
{coaches}

Conversation so far:
{conversation}
"""


def _price_question(text: str) -> bool:
    return bool(
        re.search(
            r"\b(price|pricing|cost|how much|fee|fees|hinta|hinnoittelu|maksaa|kustannus|pris|kostar|kostnad)\b",
            text,
            re.I,
        )
    )


def _norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _used_variant_indexes(prior: list[str], groups: list[list[str]]) -> set[int]:
    """Which question wordings already appeared in earlier assistant turns."""
    used: set[int] = set()
    needles = [[_norm_text(item) for item in group if item] for group in groups]
    for message in prior:
        hay = _norm_text(message)
        if not hay:
            continue
        for index, group in enumerate(needles):
            if any(needle and needle in hay for needle in group):
                used.add(index)
    return used


def _stage_variants(locale: str | None, keys: list[list[str]]) -> list[list[str]]:
    return [[t(locale, key) for key in group] for group in keys]


_SITUATION_KEYS = [
    ["opener_need_situation", "opener_after_price", "opener_after_boundary"],
    ["opener_need_clarify"],
    ["opener_need_skip_offer"],
]
_TIMING_KEYS = [
    ["ask_timing", "ask_timing_short", "skip_situation_then_timing"],
    ["ask_timing_clarify"],
    ["ask_timing_skip_offer"],
]


def _next_wording(
    groups: list[list[str]],
    prior: list[str],
    latest_user: str,
    *,
    original_override: str | None = None,
) -> tuple[str | None, bool]:
    """
    Pick a wording that has not been sent yet.

    Returns (text, advance). advance means this question should be skipped
    instead of asked again in the same words.
    """
    used = _used_variant_indexes(prior, groups)
    if is_warmup_skip(latest_user) or len(used) >= len(groups):
        return None, True
    start = 1 if is_confusion(latest_user) and 0 not in used else 0
    for index in range(start, len(groups)):
        if index in used:
            continue
        text = original_override if index == 0 and original_override else groups[index][0]
        return text, False
    return None, True


def plan_follow_up(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
) -> tuple[str | None, str | None]:
    """
    Next intake line, plus an optional stage to skip: 'situation' or 'timing'.

    The same question is never returned twice. A repeat or a 'I don't understand'
    moves to a clarification, then a skip offer, then past that question.
    """
    prior = prior_assistant or []
    slots = slots or {}
    has_situation = bool(slots.get("theme") or slots.get("need_description"))
    if not has_situation:
        groups = _stage_variants(locale, _SITUATION_KEYS)
        override = t(locale, "opener_after_price") if _price_question(latest_user) else None
        text, advance = _next_wording(groups, prior, latest_user, original_override=override)
        if advance:
            return None, "situation"
        return text, None

    if not slots.get("timing"):
        groups = _stage_variants(locale, _TIMING_KEYS)
        asked = _used_variant_indexes(prior, groups)
        # The message that skipped the situation question is not also a timing skip.
        if slots.get("situation_skipped") and not asked:
            return t(locale, "skip_situation_then_timing"), None
        text, advance = _next_wording(groups, prior, latest_user)
        if advance:
            return None, "timing"
        return text, None
    return None, None


def apply_warmup_skip(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
) -> dict:
    """Fill a required slot when the visitor skips it or it has already been rephrased."""
    updated = dict(slots or {})
    _text, advance = plan_follow_up(updated, latest_user, locale, prior_assistant)
    if advance == "situation":
        if not updated.get("theme"):
            updated["theme"] = "unspecified"
        if not updated.get("need_description"):
            updated["need_description"] = "Visitor skipped describing the situation."
        updated["situation_skipped"] = True
    elif advance == "timing" and not updated.get("timing"):
        updated["timing"] = "not specified"
        updated["timing_skipped"] = True
    return updated


def boundary_reply(
    slots: dict,
    lead: str,
    locale: str | None = None,
    latest_user: str = "",
    prior_assistant: list[str] | None = None,
) -> str:
    """Refuse or redirect, then ask only the next coaching question still missing."""
    question = follow_up_reply(slots, latest_user, locale, prior_assistant=prior_assistant)
    if not question:
        return lead
    return f"{lead} {question}"


def follow_up_reply(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
) -> str | None:
    """One next question. None means the conversation is ready for a real match."""
    reply, advance = plan_follow_up(slots, latest_user, locale, prior_assistant)
    if reply:
        return reply
    if advance == "situation":
        return t(locale, "skip_situation_then_timing")
    return None


def run_formatter(state: dict) -> dict:
    latest_user = state["messages"][-1]["content"] if state.get("messages") else ""
    slots = state.get("gathered_slots", {})
    locale = state.get("locale")
    prior = [
        m.get("content") or ""
        for m in state.get("messages", [])[:-1]
        if m.get("role") == "assistant"
    ]
    if state.get("advice_blocked") or visitor_advice_rule(latest_user, state.get("organization_id")):
        state["advice_blocked"] = True
        reply = boundary_reply(slots, t(locale, "refuse_medical_legal"), locale, latest_user, prior)
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if state.get("off_topic_this_turn"):
        reply = boundary_reply(slots, t(locale, "refuse_off_topic"), locale, latest_user, prior)
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if not state.get("ready_to_match"):
        reply = follow_up_reply(slots, latest_user, locale, prior_assistant=prior)
        if reply is None:
            reply = t(locale, "ask_one_more_detail")
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state

    tone_guidance = state.get("tone_guidance", {"base_tone": "Warm and professional.", "example_phrases": []})
    mood = state.get("detected_mood", "neutral")

    matched_ids = state.get("matched_coaches", [])
    coaches = [scrub_profile(row) for row in fetch_coaches_by_ids(matched_ids)] if matched_ids else []
    settings = fetch_match_settings(state.get("organization_id"))
    if settings["show_match_score"]:
        scores = state.get("matched_coach_scores") or {}
        for coach in coaches:
            coach["match_score"] = scores.get(str(coach["id"]))
    matching_was_attempted = bool(state.get("ready_to_match"))

    # Grounded template first — this is the anti-drift baseline. An LLM polish
    # is kept only when it still passes the same checklist.
    grounded = (
        compose_match_reply(coaches, slots, locale)
        if coaches
        else compose_no_match_reply(locale)
    )

    slots = state.get("gathered_slots", {})
    required_fields = {"theme": "the theme/topic", "need_description": "more detail on the need", "timing": "timing"}
    still_missing = [label for field, label in required_fields.items() if not slots.get(field)]

    conversation_text = "\n".join(
        f"{m['role']}: {m['content']}" for m in state["messages"][-6:]
    )

    format_kwargs = dict(
        base_tone=tone_guidance["base_tone"],
        mood=mood,
        example_phrases=tone_guidance["example_phrases"],
        off_topic=bool(state.get("off_topic_this_turn")),
        coaches=coaches,
        matching_was_attempted=matching_was_attempted,
        still_missing=still_missing if still_missing else "none — all required fields gathered",
        conversation=conversation_text,
    )
    prompt_template = get_agent_prompt("formatter", FORMATTER_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(**format_kwargs)
    except (KeyError, IndexError):
        prompt = FORMATTER_SYSTEM_PROMPT_DEFAULT.format(**format_kwargs)
    prompt += (
        "\n\nNEVER give medical or legal advice. If the visitor asked for either, "
        "refuse in one sentence and then continue with the coaching conversation."
        "\nYou MUST keep every coach_name from the verified list above in your reply."
        "\nIf the coach list is empty, do not invent a coach or program name."
        f"\nAlways write the entire reply in {language_label(locale)}."
    )
    if settings["show_match_score"] and coaches:
        prompt += "\nWhen you name a profile, include its match_score as a percentage."

    try:
        llm = get_llm(temperature=0.2, agent_name="formatter", organization_id=state.get("organization_id"))
        response = llm.invoke([{"role": "system", "content": prompt}])
        polished = (response.content or "").strip()
    except Exception:
        polished = ""

    if polished and reply_is_grounded(polished, coaches, matching_was_attempted):
        chosen = polished
    else:
        chosen = grounded
    state["draft_reply"] = strip_empty_template_tokens(chosen) or chosen
    return state
