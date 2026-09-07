"""
Coach-Matching Agent.

Deliberately NOT vector/RAG-based (see blueprint Section 9.1): the coach table
is small enough to pass in full. The model is only allowed to return IDs that
were present in the verified rows it was given — anything else is rejected.
"""
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import fetch_active_coaches, get_agent_prompt


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


def run_coach_matcher(state: dict) -> dict:
    if not state.get("ready_to_match"):
        return state

    candidates = fetch_active_coaches()

    if not candidates:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
        return state

    candidate_ids = {str(c["id"]) for c in candidates}

    llm = get_llm(temperature=0.0, agent_name="coach_matcher")
    structured_llm = llm.with_structured_output(MatchResult)

    slots = state.get("gathered_slots", {})
    need_summary = (
        f"Theme: {slots.get('theme')}. "
        f"Need description: {slots.get('need_description')}. "
        f"Timing: {slots.get('timing')}. "
        f"Budget (optional, soft signal only): {slots.get('budget')}. "
        f"Group size (optional, soft signal unless out of range): {slots.get('group_size')}."
    )

    prompt_template = get_agent_prompt("coach_matcher", MATCH_SYSTEM_PROMPT_DEFAULT)
    try:
        prompt = prompt_template.format(candidates=candidates, need=need_summary)
    except (KeyError, IndexError):
        prompt = MATCH_SYSTEM_PROMPT_DEFAULT.format(candidates=candidates, need=need_summary)
    result: MatchResult = structured_llm.invoke([{"role": "system", "content": prompt}])

    # Hard safety check: reject any match whose coach_id wasn't actually in the
    # candidate set. This is the structural anti-hallucination guarantee.
    verified = [m for m in result.matches if m.coach_id in candidate_ids]
    verified.sort(key=lambda m: m.match_score, reverse=True)
    verified = verified[:3]

    if not verified:
        state["matched_coaches"] = []
        state["matched_coach_scores"] = {}
        state["outcome"] = "purchase_order"
    else:
        state["matched_coaches"] = [m.coach_id for m in verified]
        state["matched_coach_scores"] = {m.coach_id: m.match_score for m in verified}
        state["outcome"] = "matched"

    return state