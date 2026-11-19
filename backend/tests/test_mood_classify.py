"""Local mood classifier (no LLM)."""
from app.agents.mood_tone import classify_mood


def test_english_moods():
    assert classify_mood("We're thrilled and excited to start!") == "positive"
    assert classify_mood("The team is demotivated and exhausted.") == "negative"
    assert classify_mood("We need coaching for 10 people next month.") == "neutral"


def test_finnish_moods():
    assert classify_mood("Tiimimme on demotivoitunut ja uupunut.") == "negative"
    assert classify_mood("Tämä on ihanaa, odotan innolla!") == "positive"
    assert classify_mood("Haluaisimme aloittaa noin kuukauden päästä.") == "neutral"
