"""
Summarizer Agent.

Runs once the conversation reaches a "matched" or "purchase_order" outcome
and the customer has provided (or been asked for) contact info. Compiles a
structured brief for the company's team.

The brief is written in the conversation's language. A Finnish chat stores a
Finnish summary, so the log does not stay in English.
"""
import json

from app.db.connection import save_quote_request
from app.i18n import normalize_locale


def _summary_fields(locale: str, slots: dict) -> dict:
    need = str(slots.get("need_description") or slots.get("theme") or "").strip()
    timing = str(slots.get("timing") or "").strip()
    size = slots.get("group_size")
    contact = str(slots.get("contact") or "").strip()
    if locale == "fi":
        summary = (
            f"Kävijä tarvitsee valmennusta: {need}."
            if need
            else "Kävijä tarvitsee valmennusta tiimilleen."
        )
        details = []
        if timing:
            details.append(f"Aloitus: {timing}")
        if size:
            details.append(f"Ryhmäkoko: {size}")
        if contact:
            details.append(f"Yhteystieto: {contact}")
        questions = []
        if not timing:
            questions.append("Aloitusajankohta")
        if not contact:
            questions.append("Yhteystieto")
        nxt = "Tiimi ottaa yhteyttä ja lähettää tarjouksen."
    else:
        summary = (
            f"The visitor needs coaching: {need}."
            if need
            else "The visitor needs coaching for their team."
        )
        details = []
        if timing:
            details.append(f"Start: {timing}")
        if size:
            details.append(f"Group size: {size}")
        if contact:
            details.append(f"Contact: {contact}")
        questions = []
        if not timing:
            questions.append("Start date")
        if not contact:
            questions.append("Contact")
        nxt = "The team follows up and sends a quote."
    return {
        "need_summary": summary,
        "key_details": details,
        "open_questions": questions,
        "next_step": nxt,
    }


def build_locale_summary(state: dict) -> dict:
    """Structured brief in the session language, plus the other pack for the log view."""
    locale = normalize_locale(state.get("locale") or state.get("reply_locale"))
    slots = state.get("gathered_slots") or {}
    chosen = _summary_fields(locale, slots)
    other_locale = "en" if locale == "fi" else "fi"
    return {
        "locale": locale,
        **chosen,
        "by_locale": {
            locale: chosen,
            other_locale: _summary_fields(other_locale, slots),
        },
    }


def run_summarizer(state: dict) -> dict:
    outcome = state.get("outcome")
    if outcome not in ("matched", "purchase_order"):
        return state

    payload = build_locale_summary(state)
    contact = str((state.get("gathered_slots") or {}).get("contact") or "")
    save_quote_request(
        conversation_id=state["conversation_id"],
        summary_text=json.dumps(payload),
        contact_info=contact,
        is_purchase_order=(outcome == "purchase_order"),
    )
    state["quote_summary"] = payload["need_summary"]
    return state
