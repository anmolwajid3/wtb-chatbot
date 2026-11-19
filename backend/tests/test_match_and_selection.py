"""Stable shortlists and a selected coach that later turns do not drop."""
from unittest.mock import patch

from app.agents.coach_matcher import rank_coaches
from app.graph import _conversations_in_memory, forget_conversation, run_turn
from app.i18n import SUPPORTED


COACHES = [
    {
        "id": "c-antti",
        "coach_name": "Antti Mäkinen",
        "program_name": "Leadership lab",
        "short_description": "leadership team managers",
        "keywords": ["leadership"],
    },
    {
        "id": "c-juhani",
        "coach_name": "Juhani Virtanen",
        "program_name": "Team motivation",
        "short_description": "motivation energy team",
        "keywords": ["motivation"],
    },
    {
        "id": "c-mikko",
        "coach_name": "Mikko Häkkinen",
        "program_name": "Sales coaching",
        "short_description": "sales pipeline",
        "keywords": ["sales"],
    },
    {
        "id": "c-liisa",
        "coach_name": "Liisa Korhonen",
        "program_name": "Onboarding",
        "short_description": "new managers",
        "keywords": ["onboarding"],
    },
]


def test_rank_coaches_is_stable_top_n():
    slots = {"theme": "team motivation", "need_description": "the team lost motivation", "timing": "January"}
    first = rank_coaches(COACHES, slots, max_matches=3, min_match_score=50)
    second = rank_coaches(list(reversed(COACHES)), slots, max_matches=3, min_match_score=50)
    assert len(first) == 3
    assert [item.coach_id for item in first] == [item.coach_id for item in second]
    assert [item.match_score for item in first] == [item.match_score for item in second]
    assert first[0].match_score >= first[1].match_score >= first[2].match_score


def test_selected_coach_persists_on_later_turn():
    conv = "conv-selected-1"
    _conversations_in_memory[conv] = {
        "conversation_id": conv,
        "messages": [],
        "gathered_slots": {"theme": "motivation", "timing": "January"},
        "matched_coaches": ["c-juhani"],
        "matched_coach_scores": {"c-juhani": 90},
        "coach_selected": True,
        "outcome": "matched",
        "awaiting_optional_details": False,
        "handoff_complete": False,
        "session_closed": False,
        "detected_mood": "neutral",
        "mood_history": [],
        "organization_id": None,
        "locale": "fi",
        "turn_count": 4,
        "post_selection_turns": 0,
    }
    with (
        patch("app.graph._selected_coach", return_value={
            "coach_name": "Juhani Virtanen",
            "program_name": "Team motivation",
        }),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.run_coach_matcher", side_effect=AssertionError("matcher ran after selection")),
    ):
        result = run_turn(conv, "paljonko tämä maksaa?", locale="en")
    assert _conversations_in_memory[conv]["coach_selected"] is True
    assert _conversations_in_memory[conv]["matched_coaches"] == ["c-juhani"]
    assert _conversations_in_memory[conv]["locale"] == "fi"
    assert "En voi kertoa" in result["reply"]
    assert "charges" not in result["reply"].lower()
    forget_conversation(conv)


def test_language_lists_are_english_and_finnish_only():
    assert "sv" not in SUPPORTED
    assert set(SUPPORTED) == {"en", "fi"}
