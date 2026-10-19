"""Unit tests for post-selection wrap-up (no LLM / DB required for most cases)."""
from app.graph import (
    _absorb_optional_details,
    _closing_reply,
    _extract_name,
    _known_fit_sentence,
    _selection_reply,
)


def test_extract_name_and_email_phrase():
    assert _extract_name("anmol test is my name and my email is anmol.test@gmail.com") == "anmol test"


def test_absorb_stores_contact_and_format():
    state = {"gathered_slots": {"timing": "in 1 month"}}
    _absorb_optional_details(
        state,
        "anmol test is my name and my email is anmol.test@gmail.com",
    )
    assert state["gathered_slots"]["contact"] == "anmol.test@gmail.com"
    assert state["gathered_slots"]["contact_name"] == "anmol test"
    _absorb_optional_details(state, "i would like in person")
    assert state["gathered_slots"]["delivery_format"] == "in person"


def test_known_fit_sentence_reads_naturally():
    state = {"gathered_slots": {"timing": "in 1 month", "delivery_format": "in person"}}
    sentence = _known_fit_sentence(state)
    assert sentence == " I've already noted: start in 1 month, in person."


def test_selection_reply_does_not_reask_after_contact(monkeypatch):
    monkeypatch.setattr(
        "app.graph.fetch_coaches_by_ids",
        lambda ids: [{"coach_name": "John Doe", "program_name": "Team Motivation Sprint"}],
    )
    state = {
        "matched_coaches": ["abc"],
        "gathered_slots": {"timing": "in 1 month"},
        "awaiting_optional_details": False,
        "quote_complete": False,
    }
    reply, mode = _selection_reply(
        state,
        "anmol test is my name and my email is anmol.test@gmail.com",
    )
    assert mode == "ask"
    assert "anmol.test@gmail.com" in reply
    assert state["gathered_slots"]["contact"] == "anmol.test@gmail.com"

    state["awaiting_optional_details"] = True
    reply2 = _closing_reply(state, "i would like in person")
    assert "in person" in reply2.lower()
    assert "name and email" not in reply2.lower()

    state["quote_complete"] = True
    state["awaiting_optional_details"] = False
    reply3, mode3 = _selection_reply(state, "thanks, bye")
    assert mode3 == "done"
    assert "name and email" not in reply3.lower()
