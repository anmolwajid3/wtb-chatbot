"""
Grounding helpers: keep customer-facing replies tied to verified data and
product rules, instead of relying on the model to remember long prompts.
"""
import re

from app.i18n import t

PRICE_MARK = re.compile(r"[€$£]\s?\d|\d+\s?(eur|euros?|dollars?)\b", re.I)
INTERNAL_SYSTEM_TALK = re.compile(
    r"don'?t have coach information|no matches found|system hasn'?t found|"
    r"coach list (is|being) empty|matching (hasn'?t|has not) (been )?(run|attempted)|"
    r"ei ole valmentajatietoja|inga coachuppgifter",
    re.I,
)
COACHING_HINT = re.compile(
    r"\b("
    r"team|teams|coach|coaches|coaching|leadership|leader|manager|managers|"
    r"management|workplace|colleague|colleagues|staff|employee|employees|"
    r"workshop|training|motivation|communication|conflict|burnout|culture|"
    r"performance|organization|organisation|company|department|remote|hybrid|"
    r"program|programme|session|facilitate|facilitation|onboarding|retention|"
    r"productivity|wellbeing|well-being|hr\b|people\b|"
    # Finnish / Swedish coaching cues
    r"tiimi|tiimini|valmentaja|valmennus|motivaatio|johtaminen|esimies|"
    r"työyhteisö|tyopaikka|työpaikka|henkilöstö|"
    r"lag|coachning|motivation|ledning"
    r")\b",
    re.I,
)


def looks_like_coaching_need(text: str) -> bool:
    """True when the message signals a work/team/coaching context."""
    return bool(COACHING_HINT.search(text or ""))


def compose_match_reply(
    coaches: list[dict],
    slots: dict | None = None,
    locale: str | None = None,
) -> str:
    """Build a match reply only from verified coach rows."""
    slots = slots or {}
    theme = (slots.get("theme") or "").strip()
    if theme and len(theme) <= 80:
        lead = t(locale, "match_lead_theme", theme=theme)
    else:
        lead = t(locale, "match_lead_generic")

    blocks = [lead]
    for coach in coaches[:3]:
        name = (coach.get("coach_name") or "").strip()
        program = (coach.get("program_name") or "").strip()
        if not name or not program:
            continue
        desc = (coach.get("short_description") or "").strip()
        line = f"**{program}** with **{name}**"
        if desc:
            line = f"{line} — {desc}"
        score = coach.get("match_score")
        if isinstance(score, int):
            line = f"{line}{t(locale, 'match_score_suffix', score=score)}"
        blocks.append(line)

    blocks.append(t(locale, "match_quote_cta"))
    return "\n\n".join(blocks)


def compose_no_match_reply(locale: str | None = None) -> str:
    """Purchase-order path: hand off without exposing internal matching limits."""
    return t(locale, "no_match_handoff")


def required_coach_names(coaches: list[dict]) -> list[str]:
    names = []
    for coach in coaches[:3]:
        name = (coach.get("coach_name") or "").strip()
        if name:
            names.append(name)
    return names


def reply_is_grounded(reply: str, coaches: list[dict], matching_attempted: bool) -> bool:
    """
    Hard checklist for match-path replies. Returns False when the text drifts
    from verified data or product rules.
    """
    text = (reply or "").strip()
    if not text:
        return False
    if PRICE_MARK.search(text):
        return False
    if INTERNAL_SYSTEM_TALK.search(text):
        return False

    names = required_coach_names(coaches)
    if matching_attempted and names:
        lowered = text.lower()
        for name in names:
            if name.lower() not in lowered:
                return False
        return True

    if matching_attempted and not names:
        # No verified coaches: reply must not invent a named coach/program pair.
        if re.search(r"\bwith\s+\*\*[^*]+\*\*", text) or re.search(
            r"\b(?:coach|program)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", text
        ):
            return False
        return True

    return True
