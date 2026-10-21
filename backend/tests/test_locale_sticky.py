"""Conversation locale should not flip on short English like 'hi'."""
from app.agents.formatter import follow_up_reply
from app.graph import _conversations_in_memory, forget_conversation, peek_reply_locale


def test_peek_reply_locale_reads_sticky_state():
    cid = "sticky-fi-1"
    _conversations_in_memory[cid] = {"reply_locale": "fi"}
    assert peek_reply_locale(cid) == "fi"
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
    assert "Milloin tämän olisi hyvä alkaa" in reply or "Kerro omin sanoin" in reply
