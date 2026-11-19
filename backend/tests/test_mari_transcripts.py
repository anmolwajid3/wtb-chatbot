"""Mari transcripts 1, 4, 5, and 6.

The numbered logs were not in the repo. These tests follow the turns she
quoted: Finnish writing, "En ymmärtänyt", "En osaa sanoa", a full brief, and
company example phrases instead of one English stock question.
"""
import re
from contextlib import contextmanager
from unittest.mock import patch

from app.agents.formatter import follow_up_reply, run_formatter
from app.agents.grounding import is_confusion, is_dont_know
from app.graph import _conversations_in_memory, build_graph, run_turn
from app.i18n import t
import app.graph as graph_mod

_ENGLISH_STOCK = (
    "Tell me a bit about the situation",
    "That gives me a real picture",
    "When would you want this to start",
    "Before I suggest anyone, is there one more detail",
    "Great choice",
    "Could I get your name and email",
    "I still need your name and email",
)

_FI_PHRASES = (
    "Selvä. Pari lisätietoa auttaa ohjaamaan oikeaan suuntaan.",
    "Kiitos — pidän tämän käytännöllisenä ja selkeänä.",
)


def _assert_no_english_stock(reply: str) -> None:
    for line in _ENGLISH_STOCK:
        assert line not in (reply or ""), reply


def _assert_distinct(replies: list[str]) -> None:
    norms = [re.sub(r"\s+", " ", (item or "").strip().lower()) for item in replies]
    assert all(norms)
    assert len(norms) == len(set(norms)), norms


@contextmanager
def _intake(phrases=None):
    graph_mod._compiled_graph = None
    phrase_list = list(phrases or [])

    def fake_mood(state):
        state["detected_mood"] = "neutral"
        state["tone_guidance"] = {"base_tone": "Warm.", "example_phrases": list(phrase_list)}
        state["mood_history"] = list(state.get("mood_history") or [])
        return state

    def fake_guard(state):
        state["guardrail_violated"] = False
        state["review_passed"] = True
        state["final_reply"] = state.get("final_reply") or state.get("draft_reply") or ""
        return state

    with (
        patch("app.graph.run_mood_tone", side_effect=fake_mood),
        patch("app.graph.run_coach_matcher", side_effect=lambda state: state),
        patch("app.graph.run_guardrail_check", side_effect=fake_guard),
        patch("app.graph.run_response_reviewer", side_effect=fake_guard),
        patch("app.graph.run_summarizer", side_effect=fake_guard),
        patch("app.graph.save_conversation_state"),
        patch("app.agents.formatter.get_llm", side_effect=RuntimeError("no llm in tests")),
    ):
        graph_mod._compiled_graph = build_graph()
        try:
            yield
        finally:
            graph_mod._compiled_graph = None


def test_transcript_1_finnish_visitor_stays_finnish():
    """Suomeksi / En ymmärtänyt / myyntikoulutusta must not be answered in English."""
    assert is_confusion("En ymmärtänyt")
    assert is_confusion("En ymmärrä")
    conv = "transcript-1"
    _conversations_in_memory.pop(conv, None)
    with _intake():
        first = run_turn(conv, "Suomeksi", locale="en", record=False)
        second = run_turn(conv, "En ymmärtänyt", locale="en", record=False)
        third = run_turn(
            conv,
            "Haluaisin myyntikoulutusta tammikuussa",
            locale="en",
            record=False,
        )
        assert _conversations_in_memory[conv]["locale"] == "fi"
        for result in (first, second, third):
            _assert_no_english_stock(result["reply"])
        _assert_distinct([first["reply"], second["reply"], third["reply"]])
        assert "Kerro" in first["reply"] or "tilante" in first["reply"].lower()

        _conversations_in_memory[conv]["matched_coaches"] = ["c-juhani"]
        coach = {
            "id": "c-juhani",
            "coach_name": "Juhani Virtanen",
            "program_name": "Myyntikoulutus",
        }
        with (
            patch("app.graph.fetch_coaches_by_ids", return_value=[coach]),
            patch("app.graph.save_conversation_state"),
        ):
            selected = run_turn(
                conv,
                "x",
                selected_coach_id="c-juhani",
                locale="en",
                record=False,
            )
        _assert_no_english_stock(selected["reply"])
        assert "Saisinko" in selected["reply"] or "sähköpost" in selected["reply"].lower()
        assert _conversations_in_memory[conv]["locale"] == "fi"


def test_transcript_4_one_more_detail_is_not_repeated():
    """'En ymmärrä' after the extra-detail question must not hear that sentence again."""
    conv = "transcript-4"
    _conversations_in_memory.pop(conv, None)
    with _intake():
        first = run_turn(
            conv,
            "Haluaisin myyntikoulutusta tammikuussa",
            locale="fi",
            record=False,
        )
        second = run_turn(conv, "En ymmärrä", locale="en", record=False)
        third = run_turn(conv, "En osaa sanoa", locale="en", record=False)
    _assert_distinct([first["reply"], second["reply"], third["reply"]])
    for result in (first, second, third):
        _assert_no_english_stock(result["reply"])
    assert t("fi", "ask_one_more_detail") not in second["reply"]
    assert t("fi", "ask_one_more_detail") not in third["reply"]
    assert _conversations_in_memory[conv]["locale"] == "fi"


def test_transcript_5_dont_know_moves_on_without_the_same_sentence():
    """'En osaa sanoa' rephrases once, then the same question is not asked again."""
    assert is_dont_know("En osaa sanoa")
    assert is_dont_know("I don't know")
    conv = "transcript-5"
    _conversations_in_memory.pop(conv, None)
    with _intake():
        first = run_turn(
            conv,
            "Tarvitsemme myyntikoulutusta tiimille",
            locale="fi",
            record=False,
        )
        second = run_turn(conv, "En osaa sanoa", locale="fi", record=False)
        third = run_turn(conv, "En osaa sanoa", locale="fi", record=False)
    _assert_distinct([first["reply"], second["reply"], third["reply"]])
    for result in (first, second, third):
        _assert_no_english_stock(result["reply"])
    assert first["reply"] not in second["reply"]
    assert first["reply"] not in third["reply"]
    slots = _conversations_in_memory[conv]["gathered_slots"]
    assert slots.get("timing")
    assert _conversations_in_memory[conv]["locale"] == "fi"


def test_transcript_6_followups_use_example_phrases_not_the_stock_timing_line():
    """Intake follow-ups come from the company's phrases and are not repeated."""
    slots = {"theme": "myynti", "need_description": "myyntikoulutusta tiimille"}
    first = follow_up_reply(
        slots,
        "tiimille",
        locale="fi",
        example_phrases=list(_FI_PHRASES),
    )
    second = follow_up_reply(
        slots,
        "jatka",
        locale="fi",
        prior_assistant=[first],
        example_phrases=list(_FI_PHRASES),
    )
    assert first
    assert _FI_PHRASES[0] in first
    assert "That gives me a real picture" not in first
    assert "When would you want this to start" not in first
    assert second and second != first
    assert "That gives me a real picture" not in second
    assert _FI_PHRASES[0] not in second

    conv = "transcript-6"
    _conversations_in_memory.pop(conv, None)
    with _intake(_FI_PHRASES):
        opened = run_turn(
            conv,
            "Tarvitsemme myyntikoulutusta tiimille",
            locale="en",
            record=False,
        )
        brief = run_turn(
            conv,
            "Haluaisin aloittaa tammikuussa",
            locale="en",
            record=False,
        )
    _assert_no_english_stock(opened["reply"])
    _assert_no_english_stock(brief["reply"])
    assert any(phrase in opened["reply"] for phrase in _FI_PHRASES)
    assert opened["reply"] != brief["reply"]
    assert t("en", "ask_one_more_detail") not in brief["reply"]
    assert t("fi", "ask_one_more_detail") not in brief["reply"]
    assert _conversations_in_memory[conv]["locale"] == "fi"


def test_one_more_detail_formatter_never_repeats_the_same_sentence():
    state = {
        "messages": [{"role": "user", "content": "Haluaisin myyntikoulutusta tammikuussa"}],
        "gathered_slots": {
            "theme": "myynti",
            "need_description": "Haluaisin myyntikoulutusta tammikuussa",
            "timing": "tammikuussa",
        },
        "ready_to_match": False,
        "locale": "fi",
        "tone_guidance": {"example_phrases": []},
    }
    first = run_formatter(state)["final_reply"]
    state["messages"] = [
        {"role": "assistant", "content": first},
        {"role": "user", "content": "En ymmärrä"},
    ]
    second = run_formatter(state)["final_reply"]
    state["messages"] = [
        {"role": "assistant", "content": first},
        {"role": "assistant", "content": second},
        {"role": "user", "content": "En osaa sanoa"},
    ]
    third = run_formatter(state)["final_reply"]
    _assert_distinct([first, second, third])
    assert first == t("fi", "ask_one_more_detail")
    assert t("fi", "ask_one_more_detail") not in second
    assert t("fi", "ask_one_more_detail") not in third
