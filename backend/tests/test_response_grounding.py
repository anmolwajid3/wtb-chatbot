"""
Unit tests for instruction-following / anti-drift grounding.

These do not call OpenRouter or Postgres — they pin the structural
checks that keep replies on the rails.
"""
from app.agents.formatter import follow_up_reply, boundary_reply
from app.agents.grounding import (
    compose_match_reply,
    compose_no_match_reply,
    looks_like_coaching_need,
    reply_is_grounded,
)
from app.agents.intent_router import _looks_like_a_situation


SAMPLE_COACHES = [
    {
        "id": "c1",
        "coach_name": "Jane Smith",
        "program_name": "Team Motivation Sprint",
        "short_description": "Gets stuck teams moving again.",
        "match_score": 88,
    },
    {
        "id": "c2",
        "coach_name": "John Doe",
        "program_name": "Leadership Reset",
        "short_description": "For new managers under pressure.",
        "match_score": 72,
    },
]


def test_personal_aside_is_not_local_situation():
    text = "I just found out my neighbor's cat passed away yesterday and I feel sad"
    assert not looks_like_coaching_need(text)
    assert not _looks_like_a_situation(text)


def test_team_need_is_local_situation():
    text = "Our team has low motivation after the reorg and people are checked out"
    assert looks_like_coaching_need(text)
    assert _looks_like_a_situation(text)


def test_compose_match_reply_names_every_coach():
    reply = compose_match_reply(SAMPLE_COACHES, {"theme": "team motivation"})
    assert "Jane Smith" in reply
    assert "John Doe" in reply
    assert "Team Motivation Sprint" in reply
    assert "Leadership Reset" in reply
    assert "quote request" in reply.lower()
    assert reply_is_grounded(reply, SAMPLE_COACHES, matching_attempted=True)


def test_compose_no_match_reply_has_no_invented_coach():
    reply = compose_no_match_reply()
    assert "team" in reply.lower()
    assert reply_is_grounded(reply, [], matching_attempted=True)


def test_ungrounded_reply_missing_coach_name_fails():
    bad = (
        "**Team Motivation Sprint** is a strong fit for your group — "
        "Would you like a quote request?"
    )
    assert not reply_is_grounded(bad, SAMPLE_COACHES, matching_attempted=True)


def test_ungrounded_reply_with_price_fails():
    bad = compose_match_reply(SAMPLE_COACHES[:1]) + " Packages start around €1200."
    assert not reply_is_grounded(bad, SAMPLE_COACHES[:1], matching_attempted=True)


def test_ungrounded_internal_system_talk_fails():
    bad = "I don't have coach information yet, so I can't help."
    assert not reply_is_grounded(bad, [], matching_attempted=True)


def test_follow_up_asks_one_thing_at_a_time():
    assert "price" in follow_up_reply({}, "How much does this cost?").lower()
    assert "start" in follow_up_reply(
        {"theme": "leadership", "need_description": "new managers"},
        "leadership for new managers",
    ).lower()
    assert follow_up_reply(
        {"theme": "leadership", "need_description": "new managers", "timing": "next month"},
        "next month",
    ) is None


def test_boundary_reply_returns_to_coaching():
    reply = boundary_reply({}, "I can't give medical or legal advice.")
    assert "medical" in reply.lower() or "legal" in reply.lower()
    assert "team" in reply.lower() or "coach" in reply.lower()
