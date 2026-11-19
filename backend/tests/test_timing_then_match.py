"""Timing answer must return a match without another model call.

Live failure: greeting, "my team feels demotivated", the timing question,
then "i would like to start within a month" — and POST /chat returned 502.
That turn used to run matcher, polish, guardrail, reviewer, and summarizer
models back to back. This pins the short path and the deployed widget host.
"""
from pathlib import Path
from unittest.mock import patch

from app.agents.coach_matcher import rank_coaches
from app.graph import _conversations_in_memory, run_turn
from app.i18n import t
import app.graph as graph_mod

_ROOT = Path(__file__).resolve().parents[2]

_MOTIVATION = {
    "id": "c-motivation",
    "coach_name": "Jane Smith",
    "program_name": "Team Motivation Sprint",
    "short_description": "Gets stuck teams moving again.",
    "long_description": "For groups that have lost motivation.",
    "key_themes": ["motivation", "team energy"],
    "keywords": ["demotivation"],
}
_WELDING = {
    "id": "c-welding",
    "coach_name": "Wade Weld",
    "program_name": "Deep-Sea Welding Safety",
    "short_description": "Certification for offshore welders.",
    "key_themes": ["welding", "safety"],
}


def _coaches_by_ids(ids):
    rows = {_MOTIVATION["id"]: _MOTIVATION, _WELDING["id"]: _WELDING}
    return [rows[str(item)] for item in ids if str(item) in rows]


def test_demotivated_team_ranks_motivation_coach_not_welding():
    ranked = rank_coaches(
        [_WELDING, _MOTIVATION],
        {"theme": "my team feels demotivated", "need_description": "my team feels demotivated"},
        {"max_matches": 3, "min_match_score": 50},
    )
    assert [coach_id for coach_id, _score in ranked] == ["c-motivation"]
    assert ranked[0][1] >= 50


def test_timing_answer_matches_without_a_model_call():
    """The transcript that 502'd: situation, timing question, start-within-a-month."""
    conv = "timing-then-match"
    _conversations_in_memory.pop(conv, None)
    graph_mod._compiled_graph = None
    model_calls = []

    def refuse_model(*_args, **kwargs):
        model_calls.append(kwargs.get("agent_name"))
        raise AssertionError("match/timing path must not call a model")

    saved_quotes = []

    def save_quote(**kwargs):
        saved_quotes.append(kwargs)

    with (
        patch("app.agents.intent_router.get_llm", side_effect=refuse_model),
        patch("app.agents.formatter.get_llm", side_effect=refuse_model),
        patch("app.agents.guardrail_check.get_llm", side_effect=refuse_model),
        patch("app.agents.response_reviewer.get_llm", side_effect=refuse_model),
        patch("app.agents.mood_tone.get_llm", side_effect=refuse_model),
        patch(
            "app.agents.mood_tone.fetch_tone_guidance",
            return_value={"base_tone": "Warm.", "example_phrases": []},
        ),
        patch("app.agents.coach_matcher.fetch_active_coaches", return_value=[_WELDING, _MOTIVATION]),
        patch("app.agents.formatter.fetch_coaches_by_ids", side_effect=_coaches_by_ids),
        patch("app.graph.fetch_coaches_by_ids", side_effect=_coaches_by_ids),
        patch("app.agents.summarizer.save_quote_request", side_effect=save_quote),
    ):
        first = run_turn(conv, "my team feels demotivated", record=False)
        second = run_turn(conv, "i would like to start within a month", record=False)

    assert model_calls == []
    assert first["reply"] == t("en", "ask_timing")
    assert "When would you want this to start?" in first["reply"]
    assert first["outcome"] == "in_progress"
    assert first["coach_matches"] == []

    assert second["outcome"] == "matched"
    assert second["debug_ready_to_match"] is True
    assert "Jane Smith" in second["reply"]
    assert "Team Motivation Sprint" in second["reply"]
    assert "Wade Weld" not in second["reply"]
    assert t("en", "ask_timing") not in second["reply"]
    assert second["reply"] != first["reply"]
    assert [match["coach_id"] for match in second["coach_matches"]] == ["c-motivation"]
    assert saved_quotes and saved_quotes[0]["is_purchase_order"] is False
    assert _conversations_in_memory[conv]["gathered_slots"]["timing"] == "within a month"


def test_widget_deploy_files_have_no_localhost():
    for name in ("index.html", "config.js"):
        text = (_ROOT / "widget" / name).read_text(encoding="utf-8")
        assert "localhost" not in text.lower(), name
        assert "https://opas-api.fly.dev" in text, name
