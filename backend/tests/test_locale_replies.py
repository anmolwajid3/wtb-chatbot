"""Hardcoded warm-up / lead copy must follow session locale (fi/en/sv)."""
from unittest.mock import patch

from app.agents.formatter import follow_up_reply
from app.graph import (
    _conversations_in_memory,
    _handle_coach_selection,
    _known_fit_sentence,
)
from app.i18n import t


def test_finnish_warmup_opener_and_timing():
    opener = follow_up_reply({}, "moi", locale="fi")
    assert opener == t("fi", "opener_need_situation")
    assert "own words" not in opener.lower()
    assert "Tell me" not in opener

    timing = follow_up_reply(
        {"theme": "motivaatio", "need_description": "Tiimini on menettänyt motivaationsa."},
        "Haluaisin päästä alkuun kuukauden kuluessa.",
        locale="fi",
    )
    assert timing == t("fi", "ask_timing")
    assert "When would you" not in timing


def test_english_opener_unchanged_by_default():
    assert follow_up_reply({}, "hello") == t("en", "opener_need_situation")


def test_finnish_coach_selection_asks_contact_in_finnish():
    conv_id = "fi-select-1"
    _conversations_in_memory[conv_id] = {
        "conversation_id": conv_id,
        "messages": [],
        "gathered_slots": {"theme": "motivaatio", "timing": "kuukauden kuluessa"},
        "matched_coaches": ["c-juhani"],
        "coach_selected": False,
        "outcome": "matched",
        "locale": "fi",
        "detected_mood": "neutral",
        "mood_history": [],
        "organization_id": None,
    }
    coach = {
        "id": "c-juhani",
        "coach_name": "Juhani Virtanen",
        "program_name": "Tiimin motivaatiosprintti",
    }
    with (
        patch("app.graph.fetch_coaches_by_ids", return_value=[coach]),
        patch("app.graph.save_conversation_state"),
    ):
        result = _handle_coach_selection(conv_id, "c-juhani")

    reply = result["reply"]
    assert "Juhani Virtanen" in reply
    assert "Tiimin motivaatiosprintti" in reply
    assert "Great choice" not in reply
    assert "Could I get your name" not in reply
    assert "Saisinko nimesi" in reply or "sähköpost" in reply.lower()
    assert "Minulla on jo" in reply or "aloitus" in reply


def test_finnish_known_fit_sentence():
    state = {
        "locale": "fi",
        "gathered_slots": {"timing": "kuukauden kuluessa", "group_size": 12},
    }
    sentence = _known_fit_sentence(state)
    assert "Minulla on jo" in sentence
    assert "I already have" not in sentence
