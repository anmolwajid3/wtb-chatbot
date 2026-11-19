"""
Coach-Matching Agent.

Deliberately NOT vector/RAG-based (see blueprint Section 9.1): the coach table
is small enough to pass in full. Ranking is deterministic for a given set of
slots so the same conversation does not flip between 1 and 3 coaches.
"""
import json
import re

from pydantic import BaseModel, Field, ValidationError
from app.agents.grounding import scrub_profile
from app.db.connection import fetch_active_coaches, fetch_match_settings


class MatchedCoach(BaseModel):
    coach_id: str = Field(description="Copied EXACTLY from the provided candidate list, never invented")
    match_score: int = Field(
        description="0-100, how well this coach fits the customer's stated need relative to the "
                    "other candidates — 100 means an excellent, near-perfect fit. Use the full range "
                    "meaningfully; do not default every match to the same score."
    )


class MatchResult(BaseModel):
    matches: list[MatchedCoach] = Field(
        default_factory=list,
        description="0 to 3 matches, ordered best-first. Never invent a coach_id. Return an empty "
                    "list if nothing is a reasonable match.",
    )
    reasoning: str = Field(description="One sentence on why these coaches were chosen, or why none matched.")


MATCH_SYSTEM_PROMPT_DEFAULT = """You are matching a customer's stated coaching need against a
fixed list of real, verified coach profiles. You must ONLY return coach IDs that
appear in the provided candidate list below — never invent, guess, or hallucinate
an ID. If nothing is a good match, return an empty list; do not force a weak match.

For each match, also assign a match_score from 0-100 reflecting how well that
specific coach fits THIS customer's stated need, relative to the other candidates.
Use the full range meaningfully — an excellent, near-perfect fit should score
noticeably higher than a workable-but-imperfect one. Do not default every match
to the same score.

Treat budget and group size as soft signals when present, not hard filters, unless
the customer's stated group size clearly falls outside a coach's min/max range —
in that case, exclude that coach.

Candidate coaches (JSON):
{candidates}

Customer's need:
{need}
"""


def _match_result_from_payload(payload) -> MatchResult | None:
    """Accept a normal object, or the double-encoded string some models return."""
    if isinstance(payload, MatchResult):
        return payload if payload.matches else None
    if isinstance(payload, str):
        payload = json.loads(payload)
    if isinstance(payload, dict) and isinstance(payload.get("matches"), str):
        nested = json.loads(payload["matches"])
        payload = nested if isinstance(nested, dict) else {"matches": nested, "reasoning": payload.get("reasoning") or ""}
    if not isinstance(payload, dict):
        return None
    matches = []
    for item in payload.get("matches") or []:
        if isinstance(item, MatchedCoach):
            matches.append(item)
        elif isinstance(item, dict) and item.get("coach_id"):
            matches.append(MatchedCoach(coach_id=str(item["coach_id"]), match_score=int(item.get("match_score") or 0)))
    if not matches:
        return None
    return MatchResult(matches=matches, reasoning=str(payload.get("reasoning") or ""))


def _recover_match_result(err: ValidationError) -> MatchResult:
    for item in err.errors():
        try:
            parsed = _match_result_from_payload(item.get("input"))
        except (TypeError, ValueError, json.JSONDecodeError, ValidationError):
            continue
        if parsed is not None:
            return parsed
    return MatchResult(matches=[], reasoning="The match list could not be read.")


_TOKEN = re.compile(r"[0-9A-Za-zÄÖÅäöå]{3,}")


def _tokens(text: str) -> set[str]:
    return {match.group(0).lower() for match in _TOKEN.finditer(text or "")}


def _coach_blob(coach: dict) -> str:
    parts: list[str] = []
    for key in (
        "coach_name",
        "program_name",
        "short_description",
        "long_description",
        "target_group",
        "suited_situations",
        "key_themes",
        "methods",
        "keywords",
        "main_category",
        "delivery_format",
        "duration",
    ):
        value = coach.get(key)
        if isinstance(value, list):
            parts.extend(str(item) for item in value)
        elif value:
            parts.append(str(value))
    return " ".join(parts)


def _group_excludes(coach: dict, slots: dict) -> bool:
    raw = slots.get("group_size")
    if raw is None or raw == "":
        return False
    digits = re.search(r"\d+", str(raw))
    if not digits:
        return False
    size = int(digits.group(0))
    low = coach.get("group_size_min")
    high = coach.get("group_size_max")
    if low is not None and size < int(low):
        return True
    if high is not None and size > int(high):
        return True
    return False


def rank_coaches(
    candidates: list[dict],
    slots: dict | None,
    max_matches: int,
    min_match_score: int,
) -> list[MatchedCoach]:
    """
    Same slots and the same roster always produce the same top N.

    Scores are a stable rank mapped above the company's minimum, so the
    threshold cannot shrink the list from one turn to the next.
    """
    limit = max(0, int(max_matches))
    if limit == 0 or not candidates:
        return []
    slots = slots or {}
    need = " ".join(
        str(slots.get(key) or "")
        for key in ("theme", "need_description", "timing", "budget", "group_size")
    )
    need_tokens = _tokens(need)
    scored: list[tuple[int, str]] = []
    for coach in candidates:
        if _group_excludes(coach, slots):
            continue
        coach_id = str(coach.get("id") or "")
        if not coach_id:
            continue
        overlap = len(need_tokens & _tokens(_coach_blob(coach)))
        scored.append((overlap, coach_id))
    scored.sort(key=lambda item: (-item[0], item[1]))
    top = scored[:limit]
    if not top:
        return []
    floor = max(0, min(99, int(min_match_score)))
    span = max(1, 99 - floor)
    count = len(top)
    ranked: list[MatchedCoach] = []
    for index, (_overlap, coach_id) in enumerate(top):
        if count == 1:
            score = min(99, floor + span)
        else:
            score = floor + round(span * (count - 1 - index) / (count - 1))
        ranked.append(MatchedCoach(coach_id=coach_id, match_score=int(score)))
    return ranked


def run_coach_matcher(state: dict) -> dict:
    if not state.get("ready_to_match"):
        return state
    # A chosen coach stays chosen. Later turns must not draw a new shortlist.
    if state.get("coach_selected"):
        return state

    candidates = [scrub_profile(row) for row in fetch_active_coaches(state.get("organization_id"))]

    if not candidates:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
        return state

    slots = state.get("gathered_slots", {})
    settings = fetch_match_settings(state.get("organization_id"))
    # Fixed top N from the roster. A model call here used to return 1 coach on
    # one turn and 3 on the next for the same slots.
    verified = rank_coaches(
        candidates,
        slots,
        settings["max_matches"],
        settings["min_match_score"],
    )

    if not verified:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
    else:
        state["matched_coaches"] = [m.coach_id for m in verified]
        state["matched_coach_scores"] = {m.coach_id: m.match_score for m in verified}
        state["outcome"] = "matched"

    return state