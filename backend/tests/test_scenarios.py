"""
Scenario tests per blueprint Section 17. These call the real graph and hit
the real database and LLM — they are integration tests, not unit tests, and
require a working .env (DATABASE_URL + OPENROUTER_API_KEY) and seeded
synthetic coach data (scripts/seed_synthetic_coaches.sql) to run.

Run with: pytest tests/test_scenarios.py -v -s
"""
import uuid
import pytest
from app.graph import run_turn


def test_warm_up_before_recommendation():
    """The bot must not recommend on the very first message."""
    conv_id = str(uuid.uuid4())
    result = run_turn(conv_id, "we need help with team motivation for about 15 people")
    assert result["outcome"] == "in_progress", (
        "Bot should ask a clarifying question first, not recommend immediately"
    )


def test_mood_variety_positive():
    conv_id = str(uuid.uuid4())
    run_turn(conv_id, "This is exciting, we're really looking forward to finding a great coach!")
    result = run_turn(conv_id, "We need leadership coaching for our management team of 8 people, starting next month")
    assert result["detected_mood"] == "positive"


def test_mood_variety_negative():
    conv_id = str(uuid.uuid4())
    run_turn(conv_id, "We've tried three coaches already and nothing has worked, I'm honestly at my wit's end")
    result = run_turn(conv_id, "We need leadership coaching for our management team of 8 people, starting next month")
    assert result["detected_mood"] == "negative"


def test_no_match_triggers_purchase_order():
    """A need no synthetic coach covers should route to Purchase Order, not a fabricated match."""
    conv_id = str(uuid.uuid4())
    run_turn(conv_id, "We need a coach specialized in deep-sea welding safety certification")
    result = run_turn(conv_id, "It's for a team of 6 offshore engineers, sometime next quarter")
    assert result["outcome"] == "purchase_order"
    assert not result["reply"].lower().count("€")  # no invented pricing either


def test_guardrail_blocks_price_question():
    conv_id = str(uuid.uuid4())
    run_turn(conv_id, "We need team coaching for 10 people")
    run_turn(conv_id, "leadership development, sometime in the next 2 months")
    result = run_turn(conv_id, "Can you just give me a rough price estimate right now?")
    reply_lower = result["reply"].lower()
    assert "€" not in result["reply"]
    assert not any(word in reply_lower for word in ["per hour", "package price", "costs about"])


def test_spam_is_filtered():
    conv_id = str(uuid.uuid4())
    result = run_turn(conv_id, "BUY CHEAP WATCHES NOW CLICK HERE!!!")
    assert result["outcome"] == "spam"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
