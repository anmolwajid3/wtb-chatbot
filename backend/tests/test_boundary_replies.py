"""Unit tests for warm-up boundary replies (no LLM / DB)."""
from app.agents.formatter import follow_up_reply, boundary_reply
from app.agents.guardrail_check import ADVICE_REQUEST


def test_price_question_asks_for_the_situation_first():
    reply = follow_up_reply({}, "how much does this cost?")
    assert reply is not None
    assert "price" in reply.lower() or "quote" in reply.lower()


def test_finnish_timing_follow_up_does_not_echo_theme():
    slots = {
        "theme": "Tiimini on alkanut tuntea itsensä motivoitumattomaksi, eikä",
        "need_description": "Tiimini on alkanut tuntea itsensä motivoitumattomaksi",
    }
    reply = follow_up_reply(slots, slots["need_description"], "fi")
    assert reply is not None
    assert "Milloin" in reply
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
    from app.i18n import t

    reply = boundary_reply({}, t("en", "refuse_medical_legal"), "en")
    assert "can't give medical or legal advice" in reply.lower()
    assert "tell me" in reply.lower() or "situation" in reply.lower()


def test_finnish_boundary_reply_language():
    from app.i18n import t

    reply = boundary_reply({}, t("fi", "refuse_medical_legal"), "fi")
    assert "lääketieteellistä" in reply.lower() or "juridista" in reply.lower()
    assert "can't give medical" not in reply.lower()


def test_finnish_follow_up_language():
    reply = follow_up_reply({}, "hei", "fi")
    assert reply is not None
    assert "kerro" in reply.lower() or "tilanteesta" in reply.lower()
    assert "tell me" not in reply.lower()


def test_warm_up_applies_negative_example_phrase():
    from app.agents.formatter import run_formatter

    state = {
        "messages": [{"role": "user", "content": "Our team is demotivated and exhausted."}],
        "gathered_slots": {
            "theme": "team motivation",
            "need_description": "demotivated team",
        },
        "ready_to_match": False,
        "locale": "en",
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


def test_finnish_timing_unlocks_follow_up():
    slots = {
        "theme": "team motivation",
        "need_description": "team is demotivated",
        "timing": "noin kuukauden päästä",
    }
    assert follow_up_reply(slots, "Haluaisimme aloittaa noin kuukauden päästä.", "fi") is None


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
    assert priced is not None
    assert "when would you" not in priced.lower()
    assert "milloin" in priced.lower() or "hinnasta" in priced.lower()


def test_formatter_offtopic_after_cat_death():
    from app.agents.formatter import run_formatter

    state = {
        "messages": [{"role": "user", "content": "Kissani on kuollut, eikä se tunnu hyvältä."}],
        "gathered_slots": {},
        "ready_to_match": False,
        "locale": "fi",
        "off_topic_this_turn": True,
        "detected_mood": "negative",
        "tone_guidance": {"base_tone": "Warm.", "example_phrases": []},
    }
    out = run_formatter(state)
    reply = out["final_reply"].lower()
    assert "ei kuulu" in reply or "kerro" in reply or "valmentajan" in reply
    assert "milloin tämän olisi hyvä alkaa" not in reply


