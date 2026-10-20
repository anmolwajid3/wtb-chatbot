"""Unit tests for warm-up boundary replies (no LLM / DB)."""
from app.agents.formatter import follow_up_reply, boundary_reply
from app.agents.guardrail_check import ADVICE_REQUEST


def test_price_question_never_asks_only_for_timing():
    slots = {"theme": "women empowerment", "need_description": "women empowerment"}
    reply = follow_up_reply(slots, "how much does this cost?")
    assert reply is not None
    assert "price" in reply.lower() or "quote" in reply.lower()
    assert "that gives me a real picture" not in reply.lower()


def test_timing_follow_up_has_no_stock_picture_line():
    slots = {"theme": "team motivation", "need_description": "team is demotivated"}
    reply = follow_up_reply(slots, "we are feeling demotivated")
    assert reply is not None
    assert "when would you want this to start" in reply.lower()
    assert "real picture" not in reply.lower()


def test_employment_law_counts_as_legal_advice_request():
    text = "what does Finnish employment law say about women empowerment?"
    assert ADVICE_REQUEST.search(text)


def test_finnish_employment_law_counts_as_legal_advice_request():
    text = "Mitä Suomen työlainsäädäntö sanoo naisjohtajuudesta?"
    assert ADVICE_REQUEST.search(text)


def test_finnish_medical_advice_request():
    text = "Anna lääketieteellistä neuvontaa stressiin."
    assert ADVICE_REQUEST.search(text)


def test_boundary_reply_after_legal_with_no_situation():
    reply = boundary_reply({}, "advice", "en")
    assert "can't give medical or legal advice" in reply.lower()
    assert "team" in reply.lower()


def test_finnish_boundary_reply_language():
    reply = boundary_reply({}, "advice", "fi")
    assert "lääketieteellistä" in reply.lower() or "juridista" in reply.lower()


def test_finnish_follow_up_language():
    reply = follow_up_reply({}, "hei", "fi")
    assert "tiimissä" in reply.lower() or "meneillään" in reply.lower()

