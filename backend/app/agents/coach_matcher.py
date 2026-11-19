"""
Coach-Matching Agent.

Deliberately NOT vector/RAG-based (see blueprint Section 9.1): the coach table
is small enough to rank in-process. Only IDs from the verified rows are
returned — nothing is invented.

The timing answer used to call a model here, then again to polish, check,
and summarize that same turn. On the live machine those sequential calls
ran until Fly returned 502. Ranking the verified list locally keeps the
turn to a database read plus a grounded reply.
"""
import re

from app.agents.grounding import scrub_profile
from app.db.connection import fetch_active_coaches, fetch_match_settings

_STOPWORDS = {
    "the", "and", "for", "with", "our", "my", "feels", "feel", "feeling", "like",
    "would", "this", "that", "they", "them", "your", "about", "after", "into",
    "just", "really", "very", "more", "some", "when", "want", "from", "have",
    "been", "what", "need", "help", "looking", "team", "teams",
    "ja", "on", "ei", "se", "me", "että", "joka", "kun", "niin", "kuin", "tai",
    "och", "att", "det", "som", "inte", "för",
}

_TEXT_FIELDS = (
    "program_name", "short_description", "long_description", "target_group",
    "suited_situations", "key_themes", "methods", "keywords", "main_category",
    "delivery_format", "individual_or_group",
)


def _as_int(value) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _need_tokens(text: str) -> set[str]:
    words = re.findall(r"[^\W\d_]{3,}", text or "", flags=re.UNICODE)
    return {word.lower() for word in words if word.lower() not in _STOPWORDS}


def _coach_text(coach: dict) -> str:
    parts: list[str] = []
    for key in _TEXT_FIELDS:
        value = coach.get(key)
        if isinstance(value, (list, tuple)):
            parts.extend(str(item) for item in value if item)
        elif value:
            parts.append(str(value))
    return " ".join(parts).lower()


def _token_hit(token: str, blob: str) -> bool:
    if token in blob:
        return True
    # "demotivated" should still meet "motivation".
    if len(token) < 5:
        return False
    return any(token[index:index + 5] in blob for index in range(len(token) - 4))


def score_coach(need_tokens: set[str], coach: dict, group_size: int | None) -> int:
    """0-96 from overlap with verified profile text. 0 means do not offer them."""
    if not need_tokens:
        return 0
    size = _as_int(group_size)
    low = _as_int(coach.get("group_size_min"))
    high = _as_int(coach.get("group_size_max"))
    if size is not None and low is not None and size < low:
        return 0
    if size is not None and high is not None and size > high:
        return 0
    blob = _coach_text(coach)
    hits = sum(1 for token in need_tokens if _token_hit(token, blob))
    if hits == 0:
        return 0
    ratio = hits / len(need_tokens)
    return min(96, int(round(70 + 26 * min(ratio, 1))))


def rank_coaches(candidates: list[dict], slots: dict, settings: dict) -> list[tuple[str, int]]:
    """Best-first (coach_id, score), limited to the company's match rules."""
    need = " ".join(
        part for part in (slots.get("theme"), slots.get("need_description")) if part
    )
    tokens = _need_tokens(need)
    ranked = []
    for coach in candidates:
        coach_id = str(coach.get("id") or "")
        if not coach_id:
            continue
        score = score_coach(tokens, coach, slots.get("group_size"))
        if score >= int(settings.get("min_match_score") or 0):
            ranked.append((coach_id, score))
    ranked.sort(key=lambda item: item[1], reverse=True)
    limit = int(settings.get("max_matches") or 3)
    return ranked[:limit]


def run_coach_matcher(state: dict) -> dict:
    if not state.get("ready_to_match"):
        return state

    candidates = [scrub_profile(row) for row in fetch_active_coaches(state.get("organization_id"))]

    if not candidates:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
        return state

    settings = fetch_match_settings(state.get("organization_id"))
    ranked = rank_coaches(candidates, state.get("gathered_slots") or {}, settings)

    if not ranked:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
    else:
        state["matched_coaches"] = [coach_id for coach_id, _score in ranked]
        state["matched_coach_scores"] = {coach_id: score for coach_id, score in ranked}
        state["outcome"] = "matched"

    return state
