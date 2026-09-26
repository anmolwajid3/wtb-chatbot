"""
Summarizer Agent.

Runs once the conversation reaches a "matched" or "purchase_order" outcome
and the customer has provided (or been asked for) contact info. Compiles a
structured brief for the company's team — the "smart pre-qualification" requirement.

Produces genuinely structured fields (not one paragraph) so the admin panel
can render a scannable card rather than a wall of text.
"""
import json
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import save_quote_request
from app.db.connection import save_quote_request, get_agent_prompt


class QuoteSummary(BaseModel):
    need_summary: str = Field(description="A one to two sentence summary of what the customer is looking for")
    key_details: list[str] = Field(
        default_factory=list,
        description="Short bullet-point facts gathered so far — group size, timing, theme, format, etc. "
                    "Each item should be a short fragment, not a full sentence.",
    )
    open_questions: list[str] = Field(
        default_factory=list,
        description="Specific things still unknown or unconfirmed that the team needs to follow up on. "
                    "Short fragments, not full sentences.",
    )
    next_step: str = Field(description="A single clear sentence describing what the team should do next")
    contact_info: str | None = Field(default=None, description="Contact info if the customer provided any, else null")


SUMMARY_SYSTEM_PROMPT_DEFAULT = """Summarize this conversation into a structured internal brief for the company's team.
Be concise and factual — key_details and open_questions should be short fragments, not full sentences.
Do not include pricing discussion since none should have occurred.

Conversation:
{conversation}
"""


def run_summarizer(state: dict) -> dict:
    outcome = state.get("outcome")
    if outcome not in ("matched", "purchase_order"):
        return state

    conversation_text = "\n".join(f"{m['role']}: {m['content']}" for m in state["messages"])

    #llm = get_llm(temperature=0.0)
    llm = get_llm(temperature=0.0, agent_name="summarizer", organization_id=state.get("organization_id"))
    structured_llm = llm.with_structured_output(QuoteSummary)

    prompt_template = get_agent_prompt("summarizer", SUMMARY_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(conversation=conversation_text)
    except (KeyError, IndexError):
        prompt = SUMMARY_SYSTEM_PROMPT_DEFAULT.format(conversation=conversation_text)
    result: QuoteSummary = structured_llm.invoke([{"role": "system", "content": prompt}])

    structured_payload = json.dumps({
        "need_summary": result.need_summary,
        "key_details": result.key_details,
        "open_questions": result.open_questions,
        "next_step": result.next_step,
    })

    save_quote_request(
        conversation_id=state["conversation_id"],
        summary_text=structured_payload,
        contact_info=result.contact_info or "",
        is_purchase_order=(outcome == "purchase_order"),
    )

    state["quote_summary"] = result.need_summary
    return state