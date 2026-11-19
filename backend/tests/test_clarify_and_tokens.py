"""Confusion should rephrase, and coach text should not leak empty tokens."""
from app.agents.formatter import apply_warmup_skip, follow_up_reply
from app.agents.grounding import compose_match_reply, is_confusion, strip_empty_template_tokens
from app.i18n import t


def test_confusion_does_not_repeat_the_same_question():
    first = follow_up_reply({}, "hello")
    second = follow_up_reply(
        {},
        "I don't understand the question",
        prior_assistant=[first],
    )
    third = follow_up_reply(
        {},
        "I still don't understand",
        prior_assistant=[first, second],
    )
    assert first == t("en", "opener_need_situation")
    assert second == t("en", "opener_need_clarify")
    assert "example" in second.lower()
    assert third == t("en", "opener_need_skip_offer")
    assert "skip" in third.lower()
    assert len({first, second, third}) == 3


def test_finnish_confusion_rephrases_instead_of_copying():
    first = t("fi", "opener_need_situation")
    second = follow_up_reply({}, "en ymmärrä", locale="fi", prior_assistant=[first])
    assert second == t("fi", "opener_need_clarify")
    assert second != first
    assert "ohita" in t("fi", "opener_need_skip_offer")


def test_repeated_timing_question_ends_in_a_skip():
    slots = {"theme": "leadership", "need_description": "new managers"}
    first = t("en", "ask_timing")
    second = t("en", "ask_timing_clarify")
    third = t("en", "ask_timing_skip_offer")
    assert follow_up_reply(slots, "huh", prior_assistant=[first]) == second
    assert follow_up_reply(slots, "what do you mean", prior_assistant=[first, second]) == third
    advanced = apply_warmup_skip(
        slots,
        "I don't understand",
        prior_assistant=[first, second, third],
    )
    assert advanced["timing"] == "not specified"
    assert follow_up_reply(
        advanced,
        "I don't understand",
        prior_assistant=[first, second, third],
    ) is None


def test_explicit_skip_moves_to_a_different_question():
    asked = t("en", "opener_need_situation")
    slots = apply_warmup_skip({}, "skip", prior_assistant=[asked])
    assert slots["situation_skipped"] is True
    bridge = follow_up_reply(slots, "skip", prior_assistant=[asked])
    assert bridge == t("en", "skip_situation_then_timing")
    assert bridge != asked


def test_real_need_is_not_treated_as_confusion():
    assert not is_confusion("I don't understand my team after the reorg")
    assert is_confusion("I don't understand the question")
    assert is_confusion("en ymmärrä")


def test_strip_empty_template_tokens():
    cleaned = strip_empty_template_tokens(
        "Works with groups of n/n people over {duration}. See [n] and ___."
    )
    assert "n/n" not in cleaned.lower()
    assert "{" not in cleaned and "}" not in cleaned
    assert "[n]" not in cleaned.lower()
    assert "___" not in cleaned
    assert "Works with groups of people over" in cleaned
    assert strip_empty_template_tokens("n/n") == ""
    assert "5/20" in strip_empty_template_tokens("Groups of 5/20")
    assert "and/or" in strip_empty_template_tokens("in person and/or remote")


def test_match_reply_drops_placeholder_tokens():
    reply = compose_match_reply(
        [
            {
                "coach_name": "Jane Smith",
                "program_name": "Team Motivation Sprint",
                "short_description": "A sprint for n/n people, lasting {weeks}.",
            }
        ],
        {"theme": "motivation"},
    )
    assert "Jane Smith" in reply
    assert "n/n" not in reply.lower()
    assert "{weeks}" not in reply
