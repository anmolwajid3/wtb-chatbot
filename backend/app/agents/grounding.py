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


# Blank template tokens that showed up inside coach suggestions ("n/n", "{duration}").
_TEMPLATE_TOKEN = re.compile(
    r"""
    (?<![A-Za-z0-9])n\s*/\s*n(?![A-Za-z0-9])
    |
    \{\{?[A-Za-z_][A-Za-z0-9_]*\}\}?
    |
    \[(?:n|x|xx|xxx|todo|tbd|placeholder)\]
    |
    <(?:n|x|xx|placeholder)>
    |
    _{3,}
    """,
    re.IGNORECASE | re.VERBOSE,
)
_DANGLING_PREP = re.compile(r"\b(of|for|about|around)\b\s*(?=[,.;:!?]|$)", re.IGNORECASE)


def strip_empty_template_tokens(text: str | None) -> str:
    """Drop unfilled template tokens and tidy the space they leave behind."""
    if not text:
        return ""
    cleaned = _TEMPLATE_TOKEN.sub(" ", str(text))
    cleaned = re.sub(r"\(\s*\)", " ", cleaned)
    cleaned = re.sub(r"\[\s*\]", " ", cleaned)
    cleaned = _DANGLING_PREP.sub("", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"\s*—\s*(?=[,.;:!?]|$)", "", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = cleaned.strip(" \t-|—/")
    if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]", cleaned):
        return ""
    return cleaned


def scrub_profile(row: dict) -> dict:
    """Copy a coach row with visitor-facing strings cleaned of empty tokens."""
    cleaned = {}
    for key, value in dict(row).items():
        if isinstance(value, str):
            cleaned[key] = strip_empty_template_tokens(value)
        elif isinstance(value, list):
            cleaned[key] = [
                strip_empty_template_tokens(item) if isinstance(item, str) else item
                for item in value
            ]
        else:
            cleaned[key] = value
    return cleaned


_CONFUSION = re.compile(
    r"("
    r"\b(?:don'?t|do not|didn'?t|doesn'?t|cannot|can'?t)\s+understand\b"
    r"|"
    r"\b(?:what do you mean|what does (?:this|that) mean|can you (?:rephrase|explain|clarify)"
    r"|please (?:rephrase|explain|clarify)|i(?:'m| am) confused|this is unclear"
    r"|not sure what you(?:'re| are) asking)\b"
    r"|"
    r"\b(?:en ymmärrä|en tajua|en käsitä|mitä tarkoitat|voitko selittää|selitä(?:\s+uudelleen)?)\b"
    r"|"
    r"\b(?:jag förstår inte|förstår inte|vad menar du|kan du förklara|jag hänger inte med)\b"
    r")",
    re.IGNORECASE,
)
_CONFUSION_SHORT = re.compile(
    r"^\s*(?:huh|what|excuse me|come again|häh|hä|mitä|va|förlåt)\s*[.?]?\s*$",
    re.IGNORECASE,
)
_WARMUP_SKIP = re.compile(
    r"^\s*(?:skip(?:\s+(?:this|it|that))?|ohita(?:\s+tämä|\s+tama)?|hoppa(?:\s+över)?|n/a)\s*[.!]?\s*$",
    re.IGNORECASE,
)


def is_confusion(text: str) -> bool:
    """Visitor is asking what the question means, not answering it."""
    raw = (text or "").strip()
    if not raw or is_warmup_skip(raw):
        return False
    if not (_CONFUSION.search(raw) or _CONFUSION_SHORT.fullmatch(raw)):
        return False
    # "I don't understand my team" is a need. "I don't understand the question" is not.
    if looks_like_coaching_need(raw) and not _CONFUSION_SHORT.fullmatch(raw):
        if re.search(r"\b(question|kysymys|kysymystä|frågan|mean|tarkoitat|menar)\b", raw, re.I):
            return True
        return False
    return True


def is_warmup_skip(text: str) -> bool:
    """Explicit skip during intake. Ambiguous words like 'no' do not count."""
    return bool(_WARMUP_SKIP.fullmatch((text or "").strip()))


def compose_match_reply(
    coaches: list[dict],
    slots: dict | None = None,
    locale: str | None = None,
) -> str:
    """Build a match reply only from verified coach rows."""
    slots = slots or {}
    theme = (slots.get("theme") or "").strip()
    if theme and len(theme) <= 80 and theme.lower() not in {"unspecified", "not specified"}:
        lead = t(locale, "match_lead_theme", theme=theme)
    else:
        lead = t(locale, "match_lead_generic")

    blocks = [lead]
    for coach in coaches[:3]:
        name = (coach.get("coach_name") or "").strip()
        program = (coach.get("program_name") or "").strip()
        if not name or not program:
            continue
        desc = strip_empty_template_tokens(coach.get("short_description") or "")
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
