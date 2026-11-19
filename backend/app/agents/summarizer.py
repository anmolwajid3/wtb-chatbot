"""
Summarizer Agent.

Runs once the conversation reaches a "matched" or "purchase_order" outcome.
Compiles a structured brief for the company's team from the slots already
gathered — no model call. The visitor is waiting on this same request for
the match cards, and a summary model was one of the sequential calls that
made the timing answer return 502.
"""
import json
from app.db.connection import save_quote_request


def _brief(state: dict) -> dict:
    slots = state.get("gathered_slots") or {}
    details = []
    theme = (slots.get("theme") or "").strip()
    if theme and theme != "unspecified":
        details.append(theme[:160])
    if slots.get("timing"):
        details.append(f"timing: {slots['timing']}")
    if slots.get("group_size"):
        details.append(f"group size: {slots['group_size']}")
    if slots.get("budget"):
        details.append(f"budget: {slots['budget']}")
    need = (slots.get("need_description") or theme or "Coaching request").strip()
    contact = (slots.get("contact") or "").strip()
    if state.get("outcome") == "purchase_order":
        next_step = "Find a coach outside the automatic list and follow up."
    elif contact:
        next_step = f"Send a quote to {contact}."
    else:
        next_step = "Follow up once the visitor shares contact details."
    return {
        "need_summary": need[:400],
        "key_details": details[:8],
        "open_questions": [] if contact else ["name and email"],
        "next_step": next_step,
        "contact_info": contact,
    }


def run_summarizer(state: dict) -> dict:
    outcome = state.get("outcome")
    if outcome not in ("matched", "purchase_order"):
        return state

    brief = _brief(state)
    state["quote_summary"] = brief["need_summary"]
    try:
        save_quote_request(
            conversation_id=state["conversation_id"],
            summary_text=json.dumps({
                "need_summary": brief["need_summary"],
                "key_details": brief["key_details"],
                "open_questions": brief["open_questions"],
                "next_step": brief["next_step"],
            }),
            contact_info=brief["contact_info"],
            is_purchase_order=(outcome == "purchase_order"),
        )
    except Exception:
        # A quote-row failure must not turn a finished match into a 502.
        pass
    return state