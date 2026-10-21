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
    # Do not parrot the visitor's situation back at them.
    assert "team motivation" not in reply.lower()
    assert "demotivated" not in reply.lower()


def test_finnish_timing_follow_up_does_not_echo_theme():
    slots = {
        "theme": "Tiimini on alkanut tuntea itsensä motivoitumattomaksi, eikä",
        "need_description": "Tiimini on alkanut tuntea itsensä motivoitumattomaksi",
    }
    reply = follow_up_reply(slots, slots["need_description"], "fi")
    assert reply is not None
    assert "Milloin tämän olisi hyvä alkaa" in reply
    assert "Tiimini" not in reply
    assert "motivoitumattomaksi" not in reply


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


def test_warm_up_applies_negative_example_phrase():
    from app.agents.formatter import run_formatter

    state = {
        "messages": [{"role": "user", "content": "Our team is demotivated and exhausted."}],
        "gathered_slots": {
            "theme": "team motivation",
            "need_description": "demotivated team",
        },
        "ready_to_match": False,
        "reply_locale": "en",
        "detected_mood": "negative",
        "tone_guidance": {
            "base_tone": "Warm.",
            "example_phrases": [
                "I hear you - carrying a tired team is heavy, and we can find steady support."
            ],
        },
    }
    out = run_formatter(state)
    reply = out["final_reply"]
    assert "carrying a tired team" in reply.lower()
    assert "when would you want this to start" in reply.lower()



def test_finnish_timing_phrase_extracted():
    from app.agents.intent_router import _timing_phrase, _group_size

    assert _timing_phrase("Haluaisimme aloittaa noin kuukauden päästä.")
    assert "kuukauden" in _timing_phrase("Haluaisimme aloittaa noin kuukauden päästä.").lower()
    assert _group_size("Tiimimme on demotivoitunut, noin 12 henkilöä.") == 12


def test_finnish_promo_is_obvious_spam_not_a_situation():
    from app.agents.intent_router import _is_obvious_spam, _looks_like_a_situation

    spam = "Osta nyt!!! alennus 50% klikkaa tästä"
    assert _is_obvious_spam(spam) is True
    assert _looks_like_a_situation(spam) is False


def test_real_finnish_team_need_still_looks_like_situation():
    from app.agents.intent_router import _is_obvious_spam, _looks_like_a_situation

    text = "Tiimimme on demotivoitunut ja energia on matala palavereissa."
    assert _is_obvious_spam(text) is False
    assert _looks_like_a_situation(text) is True


def test_finnish_timing_unlocks_follow_up():
    slots = {
        "theme": "team motivation",
        "need_description": "team is demotivated",
        "timing": "noin kuukauden päästä",
    }
    assert follow_up_reply(slots, "Haluaisimme aloittaa noin kuukauden päästä.", "fi") is None


def test_finnish_cat_death_is_off_topic_not_a_situation():
    from app.agents.intent_router import (
        _is_obvious_off_topic,
        _looks_like_a_situation,
        run_intent_router,
    )

    text = "Kissani on kuollut, eikä se tunnu hyvältä."
    assert _is_obvious_off_topic(text) is True
    assert _looks_like_a_situation(text) is False

    state = {
        "messages": [{"role": "user", "content": text}],
        "gathered_slots": {},
        "organization_id": None,
    }
    out = run_intent_router(state)
    assert out["off_topic_this_turn"] is True
    assert not out["gathered_slots"].get("theme")
    assert not out["gathered_slots"].get("need_description")


def test_finnish_maksavat_paljonko_is_price_question():
    from app.agents.intent_router import _price_question_text

    assert _price_question_text("Paljonko valmennuspalvelunne maksavat minulle?")
    assert _price_question_text("Mitä tämä maksaa?")
    reply = follow_up_reply({}, "Paljonko valmennuspalvelunne maksavat minulle?", "fi")
    assert reply is not None
    assert "hinnasta" in reply.lower() or "tarjouksen" in reply.lower()
    assert "kuollut" not in reply.lower()
    # With a prior (wrong) theme but no timing, still refuse price — don't re-ask only timing.
    stuck = {"theme": "Kissani on kuollut", "need_description": "Kissani on kuollut"}
    priced = follow_up_reply(stuck, "Paljonko valmennuspalvelunne maksavat minulle?", "fi")
    assert "hintoja" in priced.lower() or "tarjouksen" in priced.lower()


def test_formatter_offtopic_after_cat_death():
    from app.agents.formatter import run_formatter

    state = {
        "messages": [{"role": "user", "content": "Kissani on kuollut, eikä se tunnu hyvältä."}],
        "gathered_slots": {},
        "ready_to_match": False,
        "reply_locale": "fi",
        "off_topic_this_turn": True,
        "detected_mood": "negative",
        "tone_guidance": {"base_tone": "Warm.", "example_phrases": []},
    }
    out = run_formatter(state)
    reply = out["final_reply"].lower()
    assert "valmentajan" in reply or "ulkopuolella" in reply or "tiimissä" in reply
    assert "milloin tämän olisi hyvä alkaa" not in reply


