"""Warm-up counting: boundary messages must not unlock matching early."""
from app.agents.intent_router import _counts_as_intake_turn


def test_intake_count_ignores_boundary_turns():
    assert _counts_as_intake_turn(False, {"outcome": "in_progress"}) is True
    assert _counts_as_intake_turn(True, {"outcome": "in_progress"}) is False
    assert _counts_as_intake_turn(False, {"outcome": "in_progress", "off_topic_this_turn": True}) is False
    assert _counts_as_intake_turn(False, {"outcome": "spam"}) is False
    assert _counts_as_intake_turn(False, {"outcome": "in_progress", "advice_blocked": True}) is False


def test_spam_and_price_do_not_reach_followup_threshold_alone():
    """Simulate the warm-up counter a visitor hits after noise then one real ask."""
    intake = 0
    followup_turns = 2

    # Price, spam-classified, off-topic, medical — none should advance intake.
    for is_price, state in (
        (True, {"outcome": "in_progress"}),
        (False, {"outcome": "spam"}),
        (False, {"outcome": "in_progress", "off_topic_this_turn": True}),
        (False, {"outcome": "in_progress", "advice_blocked": True}),
    ):
        if _counts_as_intake_turn(is_price, state):
            intake += 1

    assert intake == 0

    # First real coaching message — still below the minimum of 2.
    if _counts_as_intake_turn(False, {"outcome": "in_progress"}):
        intake += 1
    assert intake == 1
    assert intake < followup_turns

    # Second real coaching message — now matching is allowed by turn count.
    if _counts_as_intake_turn(False, {"outcome": "in_progress"}):
        intake += 1
    assert intake >= followup_turns
