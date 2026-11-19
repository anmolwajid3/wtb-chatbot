"""Conversation locale should not flip on short English like 'hi'."""
from app.agents.formatter import follow_up_reply
from app.graph import _conversations_in_memory, _remember, forget_conversation


def test_remember_reads_selected_coach_from_memory():
    cid = "sticky-fi-1"
    _conversations_in_memory[cid] = {"locale": "fi", "coach_selected": True, "matched_coaches": ["c1"]}
    restored = _remember(cid)
    assert restored is not None
    assert restored["locale"] == "fi"
    assert restored["coach_selected"] is True
    forget_conversation(cid)


def test_finnish_follow_up_after_hi_still_finnish():
    """If sticky locale is fi, warm-up copy stays Finnish even for 'hi'."""
    slots = {
        "theme": "tiimin motivaatio",
        "need_description": "Tiimini on alkanut tuntea itsensä motivoitumattomaksi",
    }
    reply = follow_up_reply(slots, "hi", "fi")
    assert reply is not None
    assert "What's going on" not in reply
    assert "Milloin" in reply or "Kerro" in reply
