"""
Response Reviewer Agent.

A second, broader "reflection" layer that runs after the Guardrail-Checking
Agent. Where the guardrail agent enforces a small set of hard, admin-managed
rules (pricing, medical/legal advice, fabrication), this agent holistically
reviews the final draft against the conversation's own instructions: does it
match the intended base tone, does it reflect the detected mood appropriately,
does it stay natural rather than robotic/listy, and does it stick strictly to
the verified data it was given.

This is a single-pass correction, not a retry loop back through the Formatter —
if issues are found, the model is asked to produce one corrected version
directly. That bounds the added latency/cost to exactly one extra call per
turn, regardless of outcome, rather than risking an open-ended back-and-forth.
"""
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import fetch_coaches_by_ids, get_agent_prompt


class ResponseReview(BaseModel):
    meets_standards: bool = Field(description="True if the reply fully matches tone, mood, and grounding expectations")
    issues: list[str] = Field(
        default_factory=list,
        description="Specific problems found, e.g. 'too robotic', 'doesn't reflect negative mood', "
                    "'mentions a detail not present in the verified coach data'. Empty if meets_standards is True.",
    )
    revised_reply: str | None = Field(
        default=None,
        description="A corrected version of the reply fixing the issues above. Only provided if meets_standards is False.",
    )


REVIEW_SYSTEM_PROMPT_DEFAULT= """You are a quality reviewer for a coaching-company chatbot's reply,
checking it against the instructions it was supposed to follow — not the hard
safety rules (those are checked separately), but overall quality:

- Does the reply match this base tone: {base_tone}
- Does its phrasing appropriately reflect the customer's detected mood ({mood}) — enthusiastic for positive, empathetic-without-dwelling for negative, matter-of-fact for neutral?
  - Does it read as a natural conversation, not a robotic list or form?
- Does it only reference information present in the verified data below — nothing invented, nothing assumed?
- If coach data is provided below, does the reply explicitly name each coach (their coach_name) alongside their program? A reply that describes a program without naming the specific coach who delivers it is incomplete, regardless of how natural or well-written it otherwise reads.
- Does the reply ever mention, apologize for, or allude to internal system state — e.g. "I don't have coach information yet," "no matches found," "the system hasn't found anyone" — rather than just naturally asking a question or presenting a match? Customers should never see a glimpse of how the matching process works internally.

Verified coach data available this turn:
{coaches}

Reply to review:
{reply}
"""


def run_response_reviewer(state: dict) -> dict:
    reply = state.get("final_reply", "")
    if not reply:
        return state

    # The revision from the previous round already cleared the guardrail.
    # Another quality pass would keep rewriting it until the safety cap
    # threw the match away.
    if state.get("safety_loop_count", 0) >= 2 and not state.get("guardrail_violated"):
        state["review_passed"] = True
        return state

    tone_guidance = state.get("tone_guidance", {})
    base_tone = tone_guidance.get("base_tone", "Warm and professional.")
    mood = state.get("detected_mood", "neutral")

    matched_ids = state.get("matched_coaches", [])
    coaches = fetch_coaches_by_ids(matched_ids) if matched_ids else []

    #llm = get_llm(temperature=0.0)
    llm = get_llm(temperature=0.0, agent_name="response_reviewer", organization_id=state.get("organization_id"))
    structured_llm = llm.with_structured_output(ResponseReview)

    prompt_template = get_agent_prompt("response_reviewer", REVIEW_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(base_tone=base_tone, mood=mood, coaches=coaches, reply=reply)
    except (KeyError, IndexError):
        prompt = REVIEW_SYSTEM_PROMPT_DEFAULT.format(base_tone=base_tone, mood=mood, coaches=coaches, reply=reply)
    result: ResponseReview = structured_llm.invoke([{"role": "system", "content": prompt}])

    state["review_passed"] = result.meets_standards
    state["review_issues"] = result.issues

    if not result.meets_standards:
        if result.revised_reply:
            state["final_reply"] = result.revised_reply
        else:
            # The reviewer flagged a problem but didn't provide a fix. Since
            # every agent here runs at temperature=0 (deterministic), looping
            # back with unchanged text would produce the exact same verdict
            # every round — a guaranteed deadlock to the safety cap, not a
            # real negotiation toward a fix. Treat this round as passed so
            # the pipeline can make forward progress instead of stalling on
            # an unactionable complaint.
            state["review_passed"] = True

    return state