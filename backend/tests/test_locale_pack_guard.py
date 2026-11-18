"""EN sessions must never surface Finnish greeting/phrase text."""
from app.db.connection import _text_matches_locale
from app.i18n import default_greeting


def test_english_rejects_finnish_greeting_text():
    fi = "Hei! Kerro vähän, mitä etsit — niin autan löytämään sopivan."
    en = "Hi! Tell me a bit about what you're looking for."
    assert _text_matches_locale("en", en)
    assert not _text_matches_locale("en", fi)
    assert _text_matches_locale("fi", fi)


def test_default_greeting_packs_are_separate():
    assert "Kerro" in default_greeting("fi")
    assert "Hi!" in default_greeting("en") or "Hello" in default_greeting("en")
    assert default_greeting("en") != default_greeting("fi")
