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


def test_phrase_locale_labels_are_en_and_fi():
    page = _text("admin-panel/app/(dashboard)/phrases/page.tsx")
    assert '{ id: "en", label: "EN" }' in page
    assert '{ id: "fi", label: "FI" }' in page
    assert 'label: "SV"' not in page
    assert 'id: "sv"' not in page
