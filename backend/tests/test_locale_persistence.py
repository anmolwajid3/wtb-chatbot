"""Locale must survive LangGraph turns and stick for Finnish intake."""
from typing import TypedDict
from unittest.mock import patch

from langgraph.graph import END, StateGraph

from app.agents.formatter import follow_up_reply, run_formatter
from app.graph import ChatState, _conversations_in_memory, build_graph, run_turn
from app.i18n import infer_locale_from_text, resolve_locale, t
import app.graph as graph_mod


def test_langgraph_keeps_locale_when_declared_on_chatstate():
    """Regression: undeclared keys were stripped; ChatState must declare locale."""
    assert "locale" in ChatState.__annotations__

    def echo(state: ChatState) -> ChatState:
        assert state.get("locale") == "fi"
        state["final_reply"] = t(state.get("locale"), "ask_timing")
        return state

    g = StateGraph(ChatState)
    g.add_node("echo", echo)
    g.set_entry_point("echo")
    g.add_edge("echo", END)
    out = g.compile().invoke(
        {
            "conversation_id": "x",
            "organization_id": None,
            "messages": [],
            "turn_count": 1,
            "gathered_slots": {},
            "ready_to_match": False,
            "detected_mood": "neutral",
            "mood_history": [],
            "tone_guidance": {},
            "matched_coaches": [],
            "matched_coach_scores": {},
            "coach_selected": False,
            "post_selection_turns": 0,
            "outcome": "in_progress",
            "draft_reply": "",
            "guardrail_violated": False,
            "guardrail_which_rule": None,
            "guardrail_regex_flagged": False,
            "review_passed": True,
            "review_issues": [],
            "safety_loop_count": 0,
            "safety_fallback_used": False,
            "advice_blocked": False,
            "off_topic_this_turn": False,
            "final_reply": "",
            "quote_summary": "",
            "locale": "fi",
            "awaiting_optional_details": False,
            "handoff_complete": False,
            "session_closed": False,
        }
    )
    assert out["locale"] == "fi"
    assert out["final_reply"] == t("fi", "ask_timing")
    assert "When would you" not in out["final_reply"]


def test_infer_finnish_from_transcript_line():
    assert infer_locale_from_text("Tiimini on menettämässä motivaationsa.") == "fi"
    assert resolve_locale(requested=None, message="Haluaisin aloittaa noin kuukauden kuluttua.") == "fi"
    # Cookie stuck on en while visitor writes Finnish → upgrade.
    assert resolve_locale(requested="en", message="Tiimini on menettämässä motivaationsa.") == "fi"
    # Explicit FI wins.
    assert resolve_locale(requested="fi", message="hello") == "fi"
    # Missing request keeps session FI.
    assert resolve_locale(requested=None, session_locale="fi", message="ok") == "fi"


def test_formatter_timing_uses_state_locale():
    reply = follow_up_reply(
        {"theme": "motivaatio", "need_description": "Tiimini on menettämässä motivaationsa."},
        "moi",
        locale="fi",
    )
    assert reply == t("fi", "ask_timing")

    state = {
        "messages": [{"role": "user", "content": "Tiimini on menettämässä motivaationsa."}],
        "gathered_slots": {
            "theme": "motivaatio",
            "need_description": "Tiimini on menettämässä motivaationsa.",
        },
        "ready_to_match": False,
        "locale": "fi",
    }
    out = run_formatter(state)
    assert out["final_reply"] == t("fi", "ask_timing")
    assert "That gives me a real picture" not in out["final_reply"]


def test_run_turn_persists_finnish_locale_through_graph():
    """Full turn: locale must still be fi after graph.invoke writes memory."""
    graph_mod._compiled_graph = None
    conv_id = "fi-persist-1"
    _conversations_in_memory.pop(conv_id, None)

    def fake_intent(state):
        state["turn_count"] = state.get("turn_count", 0) + 1
        state["gathered_slots"] = {
            "theme": "motivaatio",
            "need_description": state["messages"][-1]["content"],
        }
        state["ready_to_match"] = False
        state["outcome"] = "in_progress"
        state["off_topic_this_turn"] = False
        state["advice_blocked"] = False
        return state

    def fake_mood(state):
        state["detected_mood"] = "neutral"
        state["tone_guidance"] = {"base_tone": "Warm.", "example_phrases": []}
        state["mood_history"] = []
        return state

    def fake_match(state):
        return state

    with (
        patch("app.graph.run_intent_router", side_effect=fake_intent),
        patch("app.graph.run_mood_tone", side_effect=fake_mood),
        patch("app.graph.run_coach_matcher", side_effect=fake_match),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.fetch_coaches_by_ids", return_value=[]),
    ):
        graph_mod._compiled_graph = build_graph()
        result = run_turn(
            conv_id,
            "Tiimini on menettämässä motivaationsa.",
            locale="fi",
            record=False,
        )

    assert result["reply"] == t("fi", "ask_timing")
    assert "When would you want this to start" not in result["reply"]
    assert _conversations_in_memory[conv_id]["locale"] == "fi"
