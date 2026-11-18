"""URL/widget locale locks the session; never switch mid-chat from visitor text."""
from unittest.mock import patch

from langgraph.graph import END, StateGraph

from app.agents.formatter import follow_up_reply, run_formatter
from app.graph import ChatState, _conversations_in_memory, build_graph, run_turn
from app.i18n import default_greeting, resolve_locale, t
import app.graph as graph_mod


def test_langgraph_keeps_locale_when_declared_on_chatstate():
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


def test_url_lang_locks_session_no_midchat_switch():
    """?lang=en must stay English even when the visitor writes Finnish."""
    assert resolve_locale(requested="en", message="Tiimini on menettämässä motivaationsa.") == "en"
    assert resolve_locale(
        requested="fi",
        session_locale="en",
        message="Haluaisin aloittaa noin kuukauden kuluttua.",
    ) == "en"
    assert resolve_locale(requested="fi", session_locale=None) == "fi"
    assert resolve_locale(requested=None, session_locale="sv") == "sv"


def test_locale_packs_do_not_mix():
    assert "Kerro" in default_greeting("fi")
    assert "Tell me" in default_greeting("en") or "Hi!" in default_greeting("en")
    assert default_greeting("fi") != default_greeting("en")
    assert t("en", "ask_timing") != t("fi", "ask_timing")
    assert "When would you" in t("en", "ask_timing")
    assert "Milloin" in t("fi", "ask_timing")


def test_formatter_timing_uses_state_locale():
    state = {
        "messages": [{"role": "user", "content": "Tiimini on menettämässä motivaationsa."}],
        "gathered_slots": {
            "theme": "motivaatio",
            "need_description": "Tiimini on menettämässä motivaationsa.",
        },
        "ready_to_match": False,
        "locale": "en",
    }
    out = run_formatter(state)
    # EN session stays EN despite Finnish visitor text.
    assert out["final_reply"] == t("en", "ask_timing")
    assert "Milloin" not in out["final_reply"]


def test_run_turn_keeps_english_lock_with_finnish_message():
    graph_mod._compiled_graph = None
    conv_id = "en-lock-1"
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

    with (
        patch("app.graph.run_intent_router", side_effect=fake_intent),
        patch("app.graph.run_mood_tone", side_effect=fake_mood),
        patch("app.graph.run_coach_matcher", side_effect=lambda s: s),
        patch("app.graph.save_conversation_state"),
        patch("app.graph.fetch_coaches_by_ids", return_value=[]),
    ):
        graph_mod._compiled_graph = build_graph()
        r1 = run_turn(
            conv_id,
            "Tiimini on menettämässä motivaationsa.",
            locale="en",
            record=False,
        )
        assert r1["reply"] == t("en", "ask_timing")
        assert _conversations_in_memory[conv_id]["locale"] == "en"

        # Later request claiming fi must not flip a locked EN session.
        r2 = run_turn(
            conv_id,
            "Haluaisin aloittaa noin kuukauden kuluttua.",
            locale="fi",
            record=False,
        )
        assert _conversations_in_memory[conv_id]["locale"] == "en"
        assert "Milloin" not in (r2["reply"] or "")


def test_finnish_url_pack_opener():
    assert follow_up_reply({}, "moi", locale="fi") == t("fi", "opener_need_situation")
