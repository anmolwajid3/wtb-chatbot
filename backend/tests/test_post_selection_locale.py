"""Post-selection wrap-up must stay in the visitor's reply language."""
from app.graph import (
    _closing_reply,
    _known_fit_sentence,
    _selection_reply,
)


def test_finnish_selection_reply_asks_for_contact():
    state = {
        "reply_locale": "fi",
        "gathered_slots": {"timing": "noin kuukauden päästä"},
        "matched_coaches": [],
    }
    # No coach row — still must be Finnish, not "Great choice".
    reply, mode = _selection_reply(state, "ok")
    assert mode == "stay"
    assert "Tarvitsen vielä nimesi ja sähköpostisi" in reply
    assert "Great choice" not in reply
    assert "I still need" not in reply


def test_finnish_known_fit_sentence():
    state = {
        "reply_locale": "fi",
        "gathered_slots": {"timing": "noin kuukauden päästä", "group_size": 12},
    }
    sentence = _known_fit_sentence(state)
    assert "Minulla on jo" in sentence
    assert "I already have" not in sentence
    assert "noin 12 henkilöä" in sentence


def test_finnish_price_ask_after_selection():
    state = {
        "reply_locale": "fi",
        "gathered_slots": {"timing": "ensi kuussa"},
        "matched_coaches": [],
    }
    reply, mode = _selection_reply(state, "Paljonko tämä maksaa?")
    assert mode == "stay"
    assert "En voi kertoa" in reply
    assert "charges" not in reply.lower()


def test_finnish_closing_reply():
    state = {
        "reply_locale": "fi",
        "gathered_slots": {"timing": "ensi kuussa"},
        "matched_coaches": [],
    }
    reply = _closing_reply(state, "haluaisin lähivalmennuksen")
    assert "Välitän tämän tiimille" in reply
    assert "I'll pass" not in reply


def test_english_selection_reply_unchanged():
    state = {
        "reply_locale": "en",
        "gathered_slots": {"timing": "next month"},
        "matched_coaches": [],
    }
    reply, mode = _selection_reply(state, "ok")
    assert mode == "stay"
    assert "I still need your name and email" in reply


def test_finnish_coach_pick_reply(monkeypatch):
    from app import graph

    cid = "fi-select-test"
    graph._conversations_in_memory[cid] = {
        "conversation_id": cid,
        "reply_locale": "fi",
        "messages": [],
        "gathered_slots": {"timing": "noin kuukauden päästä"},
        "matched_coaches": ["coach-1"],
        "mood_history": [],
        "organization_id": None,
        "outcome": "matched",
        "coach_selected": False,
    }
    monkeypatch.setattr(
        graph,
        "fetch_coaches_by_ids",
        lambda ids: [{"coach_name": "Juhani Virtanen", "program_name": "Tiimin motivaatiosprintti"}],
    )
    monkeypatch.setattr(graph, "save_conversation_state", lambda **kwargs: None)

    out = graph._handle_coach_selection(cid, "coach-1")
    reply = out["reply"]
    assert "Hyvä valinta" in reply
    assert "Juhani Virtanen" in reply
    assert "Tiimin motivaatiosprintti" in reply
    assert "sähköpostisi" in reply
    assert "Great choice" not in reply
    graph.forget_conversation(cid)
