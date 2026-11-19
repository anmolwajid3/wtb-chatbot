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
    PRICE_MARK,
    compose_match_reply,
    compose_no_match_reply,
    is_confusion,
    is_dont_know,
    is_warmup_skip,
    scrub_profile,
    strip_empty_template_tokens,
)
from app.i18n import (
    OPENER_NEED_SITUATION,
    detect_message_locale,
    normalize_locale,
    reply_language_ok,
    resolve_locale,
    t,
)
from app.llm import get_llm  # tests patch this; the match reply does not call it
from app.db.connection import fetch_coaches_by_ids, fetch_match_settings


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
_ONE_MORE_KEYS = [
    ["ask_one_more_detail"],
    ["ask_one_more_rephrase"],
]
_ENGLISH_PHRASE = re.compile(
    r"\b(tell me|when would you|that gives me|before i suggest|great choice|got it|a couple of details)\b",
    re.I,
)


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
    instead of asked again in the same words. "I don't know" gets one
    rephrase, then moves on.
    """
    used = _used_variant_indexes(prior, groups)
    if is_warmup_skip(latest_user) or len(used) >= len(groups):
        return None, True
    if is_dont_know(latest_user) and (len(used) >= 2 or 1 in used):
        return None, True
    if is_dont_know(latest_user) and len(groups) > 1 and 1 not in used:
        return groups[1][0], False
    start = 1 if is_confusion(latest_user) and 0 not in used else 0
    for index in range(start, len(groups)):
        if index in used:
            continue
        text = original_override if index == 0 and original_override else groups[index][0]
        return text, False
    return None, True


def _phrase_fits(locale: str | None, phrase: str) -> bool:
    loc = normalize_locale(locale)
    detected = detect_message_locale(phrase)
    if loc == "fi" and (_ENGLISH_PHRASE.search(phrase) or detected == "sv"):
        return False
    if loc == "en" and detected in ("fi", "sv"):
        return False
    if loc == "sv" and (detected == "fi" or _ENGLISH_PHRASE.search(phrase)):
        return False
    return True


def _exact_sentence(text: str, prior: list[str]) -> bool:
    needle = _norm_text(text)
    if not needle:
        return False
    return any(needle == _norm_text(message) for message in prior)


def _phrase_used(phrase: str, prior: list[str]) -> bool:
    needle = _norm_text(phrase)
    if not needle:
        return True
    return any(needle == _norm_text(message) or needle in _norm_text(message) for message in prior)


def _unused_phrase(phrases: list[str] | None, prior: list[str], locale: str | None) -> str | None:
    for phrase in phrases or []:
        text = str(phrase or "").strip()
        if not text or not _phrase_fits(locale, text) or _phrase_used(text, prior):
            continue
        return text
    return None


def _lead_with_phrase(
    text: str | None,
    phrases: list[str] | None,
    prior: list[str],
    locale: str | None,
    slot: str | None,
    latest_user: str = "",
) -> str | None:
    """Use an unused company phrase instead of repeating a stock intake line."""
    if not text:
        return text
    if is_confusion(latest_user) or is_dont_know(latest_user) or is_warmup_skip(latest_user):
        return None if _exact_sentence(text, prior) else text
    phrase = _unused_phrase(phrases, prior, locale)
    stock = {
        t(locale, "opener_need_situation"),
        t(locale, "ask_timing"),
        t(locale, "ask_timing_short"),
        t(locale, "ask_one_more_detail"),
        t(locale, "opener_need_clarify"),
        t(locale, "ask_timing_clarify"),
        t(locale, "ask_one_more_rephrase"),
    }
    if phrase and text in stock:
        if slot == "timing" and not re.search(r"\b(when|milloin|när)\b", phrase, re.I):
            short = t(locale, "ask_timing_short")
            if _norm_text(short) not in _norm_text(phrase):
                combined = f"{phrase} {short}".strip()
                if not _exact_sentence(combined, prior):
                    return combined
        if not _exact_sentence(phrase, prior):
            return phrase
    if _exact_sentence(text, prior):
        return None
    return text


def _avoid_repeat(reply: str | None, prior: list[str], locale: str | None) -> str:
    """Never send the identical sentence that was already said."""
    if not reply:
        return ""
    if not _exact_sentence(reply, prior):
        return reply
    for key in ("ask_one_more_rephrase", "intake_move_on", "opener_need_clarify", "ask_timing_clarify"):
        alt = t(locale, key)
        if alt and not _exact_sentence(alt, prior) and _norm_text(alt) != _norm_text(reply):
            return alt
    return ""


def plan_follow_up(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
    example_phrases: list[str] | None = None,
) -> tuple[str | None, str | None]:
    """
    Next intake line, plus an optional stage to skip: 'situation' or 'timing'.

    The same question is never returned twice. A repeat or a 'I don't understand'
    moves to a clarification, then a skip offer, then past that question.
    When the company has example phrases for this locale, those lead the
    question instead of one hardcoded stock line.
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
        return _lead_with_phrase(text, example_phrases, prior, locale, "situation", latest_user), None

    if not slots.get("timing"):
        groups = _stage_variants(locale, _TIMING_KEYS)
        asked = _used_variant_indexes(prior, groups)
        # The message that skipped the situation question is not also a timing skip.
        if slots.get("situation_skipped") and not asked:
            return t(locale, "skip_situation_then_timing"), None
        text, advance = _next_wording(groups, prior, latest_user)
        if advance:
            return None, "timing"
        return _lead_with_phrase(text, example_phrases, prior, locale, "timing", latest_user), None
    return None, None


def apply_warmup_skip(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
    example_phrases: list[str] | None = None,
) -> dict:
    """Fill a required slot when the visitor skips it or it has already been rephrased."""
    updated = dict(slots or {})
    _text, advance = plan_follow_up(
        updated, latest_user, locale, prior_assistant, example_phrases=example_phrases
    )
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
    example_phrases: list[str] | None = None,
) -> str:
    """Refuse or redirect, then ask only the next coaching question still missing."""
    question = follow_up_reply(
        slots,
        latest_user,
        locale,
        prior_assistant=prior_assistant,
        example_phrases=example_phrases,
    )
    if not question:
        return lead
    return f"{lead} {question}"


def follow_up_reply(
    slots: dict,
    latest_user: str,
    locale: str | None = None,
    prior_assistant: list[str] | None = None,
    example_phrases: list[str] | None = None,
) -> str | None:
    """One next question. None means the conversation is ready for a real match."""
    reply, advance = plan_follow_up(
        slots, latest_user, locale, prior_assistant, example_phrases=example_phrases
    )
    if reply:
        return _avoid_repeat(reply, prior_assistant or [], locale) or None
    if advance == "situation":
        bridge = t(locale, "skip_situation_then_timing")
        return _avoid_repeat(bridge, prior_assistant or [], locale) or None
    return None


def _one_more_detail(
    slots: dict,
    latest_user: str,
    locale: str | None,
    prior: list[str],
    phrases: list[str],
) -> str:
    """One extra question after a full brief, then a different line, then stop repeating."""
    groups = _stage_variants(locale, _ONE_MORE_KEYS)
    text, advance = _next_wording(groups, prior, latest_user)
    if advance or not text:
        return _avoid_repeat(t(locale, "intake_move_on"), prior, locale)
    led = _lead_with_phrase(text, phrases, prior, locale, None, latest_user)
    if not led:
        led = t(locale, "ask_one_more_rephrase") if text == t(locale, "ask_one_more_detail") else t(locale, "intake_move_on")
    return _avoid_repeat(led, prior, locale)


def run_formatter(state: dict) -> dict:
    latest_user = state["messages"][-1]["content"] if state.get("messages") else ""
    slots = state.get("gathered_slots", {})
    locale = resolve_locale(
        state.get("locale"),
        session_locale=state.get("locale"),
        message=latest_user,
    )
    state["locale"] = locale
    prior = [
        m.get("content") or ""
        for m in state.get("messages", [])[:-1]
        if m.get("role") == "assistant"
    ]
    phrases = list((state.get("tone_guidance") or {}).get("example_phrases") or [])
    if state.get("advice_blocked") or visitor_advice_rule(latest_user, state.get("organization_id")):
        state["advice_blocked"] = True
        reply = boundary_reply(
            slots, t(locale, "refuse_medical_legal"), locale, latest_user, prior, phrases
        )
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if state.get("off_topic_this_turn"):
        reply = boundary_reply(
            slots, t(locale, "refuse_off_topic"), locale, latest_user, prior, phrases
        )
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if not state.get("ready_to_match"):
        reply = follow_up_reply(
            slots, latest_user, locale, prior_assistant=prior, example_phrases=phrases
        )
        if reply is None:
            reply = _one_more_detail(slots, latest_user, locale, prior, phrases)
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state

    matched_ids = state.get("matched_coaches", [])
    coaches = [scrub_profile(row) for row in fetch_coaches_by_ids(matched_ids)] if matched_ids else []
    settings = fetch_match_settings(state.get("organization_id"))
    if settings["show_match_score"]:
        scores = state.get("matched_coach_scores") or {}
        for coach in coaches:
            coach["match_score"] = scores.get(str(coach["id"]))
    # Profile blurbs sometimes contain a price. Drop those lines rather than
    # sending the reply through another model to "fix" it.
    if any(PRICE_MARK.search(str(coach.get("short_description") or "")) for coach in coaches):
        coaches = [
            {**coach, "short_description": ""}
            if PRICE_MARK.search(str(coach.get("short_description") or ""))
            else coach
            for coach in coaches
        ]

    # The verified template is the reply. A polish call here was a second
    # model round-trip on the same turn that already matched, and it is what
    # pushed the live request past Fly's gateway.
    chosen = (
        compose_match_reply(coaches, slots, locale)
        if coaches
        else compose_no_match_reply(locale)
    )
    if not reply_language_ok(chosen, locale):
        chosen = compose_no_match_reply(locale) if not coaches else compose_match_reply(coaches, {}, locale)
    state["draft_reply"] = strip_empty_template_tokens(chosen) or chosen
    state["final_reply"] = state["draft_reply"]
    return state
