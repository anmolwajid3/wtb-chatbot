"""Widget and admin language surfaces: contrast class, EN/FI labels, no Swedish picker."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_coach_graph_name_has_light_and_dark_contrast():
    html = _text("widget/index.html")
    assert "coach-graph-name" in html
    assert "body.light .coach-graph-name" in html
    assert 'fill="#F3EFE6"' not in html


def test_widget_and_admin_language_lists_omit_swedish():
    widget = _text("widget/index.html")
    prefs = _text("admin-panel/app/components/Preferences.tsx")
    assert "SUPPORTED_LANGS = ['en', 'fi']" in widget
    assert 'data-lang="sv"' not in widget
    assert 'id: "sv"' not in prefs
    assert 'label: "SV"' not in prefs


def test_widget_logo_keeps_aspect_ratio():
    html = _text("widget/index.html")
    logo = html.split("#panel-header .brand-logo", 1)[1].split("}", 1)[0]
    assert "object-fit: contain" in logo
    assert "width: auto" in logo
    assert "align-items: flex-start" in html


def test_chat_language_control_is_en_and_fi():
    html = _text("widget/index.html")
    assert "const LANG_LABELS = { en: 'EN', fi: 'FI' }" in html
    assert 'aria-label="Chat language"' in html
    assert 'data-lang="en">EN</button>' in html
    assert 'data-lang="fi">FI</button>' in html
    assert html.count('data-lang="en"') >= 1
    assert 'data-lang="sv"' not in html


def test_finnish_match_line_does_not_paste_english_program_prose():
    from app.agents.grounding import compose_match_reply

    reply = compose_match_reply(
        [
            {
                "coach_name": "Elina Virtanen",
                "program_name": "First-Time Manager Foundation",
                "short_description": "A structured 6-week program for new managers.",
                "duration": "6 weeks",
                "delivery_format": "Hybrid",
            }
        ],
        {"theme": "tiimin motivaatio"},
        "fi",
    )
    assert "valmentajana" in reply
    assert "Elina Virtanen" in reply
    assert "structured" not in reply.lower()
    assert "with **" not in reply.lower()
    assert "6-week" not in reply.lower()
    assert "viikkoa" in reply


def test_summary_follows_finnish_session():
    from app.agents.summarizer import build_locale_summary

    payload = build_locale_summary(
        {
            "locale": "fi",
            "gathered_slots": {
                "need_description": "Tiimi menetti motivaationsa",
                "timing": "kuukauden päästä",
                "contact": "a@b.fi",
            },
        }
    )
    assert payload["locale"] == "fi"
    assert "valmennusta" in payload["need_summary"].lower()
    assert "the visitor needs" not in payload["need_summary"].lower()
    assert payload["by_locale"]["fi"]["need_summary"] == payload["need_summary"]
    assert "Aloitus" in " ".join(payload["key_details"])


def test_guardrail_sentence_is_kept_once():
    from app.agents.guardrail_check import collapse_repeated_text

    text = (
        "Never give medical or legal advice. Never give medical or legal advice. "
        "Never give medical or legal advice."
    )
    collapsed = collapse_repeated_text(text)
    assert collapsed.lower().count("never give medical or legal advice") == 1


def test_active_badge_is_not_green_on_green():
    row = _text("admin-panel/app/(dashboard)/guardrails/GuardrailRow.tsx")
    css = _text("admin-panel/app/globals.css")
    assert "bg-green-900/40 text-green-400" not in row
    assert "status-pill-active" in row
    assert ".status-pill-active" in css
    assert "color: #FFFFFF" in css.split(".status-pill-active", 1)[1].split("}", 1)[0]


def test_phrase_locale_labels_are_en_and_fi():
    page = _text("admin-panel/app/(dashboard)/phrases/page.tsx")
    assert '{ id: "en", label: "EN" }' in page
    assert '{ id: "fi", label: "FI" }' in page
    assert 'label: "SV"' not in page
    assert 'id: "sv"' not in page
