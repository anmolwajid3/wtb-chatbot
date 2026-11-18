"""
Pins the production bug: after name/email + handoff, never re-ask contact;
"okay" must stay closed.

No OpenRouter/Postgres — mocks coach lookup, summarizer, and persistence.
"""
from unittest.mock import patch

import pytest

from app.graph import (
    _conversations_in_memory,
    _handle_post_selection_message,
    _selection_reply,
    forget_conversation,
)


COACH = {
    "id": "c-juhani",
    "coach_name": "Juhani Virtanen",
    "program_name": "Team Motivation Sprint",
    "duration": "4 weeks",
    "delivery_format": "hybrid",
}


def _state(**overrides):
    base = {
        "conversation_id": "conv-lead-1",
        "messages": [],
        "gathered_slots": {"theme": "lost motivation", "timing": "December"},
        "matched_coaches": ["c-juhani"],
        "coach_selected": True,
        "outcome": "matched",
        "awaiting_optional_details": False,
        "handoff_complete": False,
        "detected_mood": "neutral",
        "mood_history": [],
        "organization_id": None,
        "final_reply": "",
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _clean_memory():
    _conversations_in_memory.clear()
    yield
    _conversations_in_memory.clear()


def test_selection_reply_does_not_reask_when_contact_exists():
    state = _state(gathered_slots={
        "theme": "lost motivation",
        "timing": "December",
        "contact": "sakari@sakke.fi",
    })
    with patch("app.graph._selected_coach", return_value=COACH):
        reply, mode = _selection_reply(state, "okay")
    assert "name and email" not in reply.lower()
    assert "sakari@sakke.fi" in reply
    assert mode in ("ask", "close")


def test_transcript_path_never_reasks_after_handoff():
    """Exact production sequence after coach selection."""
    conv_id = "conv-lead-1"
    _conversations_in_memory[conv_id] = _state()

    with (
        patch("app.graph._selected_coach", return_value=COACH),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.run_summarizer", side_effect=lambda s: s) as summarizer,
    ):
        r1 = _handle_post_selection_message(
            conv_id, "Sakari Kostilainen, email sakari@sakke.fi"
        )
        assert "sakari@sakke.fi" in r1["reply"].lower()
        assert "name and email" not in r1["reply"].lower()
        assert _conversations_in_memory[conv_id]["gathered_slots"]["contact"] == "sakari@sakke.fi"
        assert _conversations_in_memory[conv_id]["awaiting_optional_details"] is True
        assert summarizer.call_count == 0

        r2 = _handle_post_selection_message(
            conv_id,
            "about 40 people would be coming, close training and on weekdays",
        )
        assert "pass" in r2["reply"].lower() or "send" in r2["reply"].lower()
        assert _conversations_in_memory[conv_id]["handoff_complete"] is True
        assert summarizer.call_count == 1

        r3 = _handle_post_selection_message(conv_id, "okay")
        assert "name and email" not in r3["reply"].lower()
        assert "You're all set" not in r3["reply"]
        assert "take care" in r3["reply"].lower() or "glad" in r3["reply"].lower()
        assert _conversations_in_memory[conv_id]["session_closed"] is True

        r4 = _handle_post_selection_message(conv_id, "bye")
        assert r4["reply"] == ""
        assert _conversations_in_memory[conv_id]["session_closed"] is True


def test_okay_during_optional_details_closes_without_reask():
    conv_id = "conv-lead-2"
    _conversations_in_memory[conv_id] = _state(
        gathered_slots={
            "theme": "lost motivation",
            "timing": "December",
            "contact": "sakari@sakke.fi",
        },
        awaiting_optional_details=True,
    )
    with (
        patch("app.graph._selected_coach", return_value=COACH),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.run_summarizer", side_effect=lambda s: s),
    ):
        result = _handle_post_selection_message(conv_id, "okay")
    assert "name and email" not in result["reply"].lower()
    assert _conversations_in_memory[conv_id]["handoff_complete"] is True


def test_ok_then_bye_after_handoff_ends_session():
    """Production transcript: handoff → ok (one goodbye) → bye (silence)."""
    conv_id = "conv-lead-3"
    _conversations_in_memory[conv_id] = _state(
        gathered_slots={
            "theme": "motivation",
            "timing": "soon",
            "contact": "emmadawson@gmail.com",
        },
        awaiting_optional_details=False,
        handoff_complete=True,
        session_closed=False,
    )
    with (
        patch("app.graph._selected_coach", return_value=COACH),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.run_summarizer", side_effect=lambda s: s),
    ):
        r_ok = _handle_post_selection_message(conv_id, "ok")
        assert r_ok["reply"]
        assert "You're all set" not in r_ok["reply"]
        assert "emmadawson@gmail.com" not in r_ok["reply"]
        assert _conversations_in_memory[conv_id]["session_closed"] is True

        r_bye = _handle_post_selection_message(conv_id, "bye")
        assert r_bye["reply"] == ""
        # No second assistant bubble recorded for silence.
        assistant_msgs = [
            m for m in _conversations_in_memory[conv_id]["messages"] if m["role"] == "assistant"
        ]
        assert len(assistant_msgs) == 1
