"""
Mood & Tone Agent.

Per the technical brief (Section 11.1 of the blueprint): mood is re-assessed
EVERY turn, not locked in from the opening message. This agent does not write
the customer-facing reply itself — it only classifies mood and prepares tone
guidance for the Formatter agent to use downstream.
"""
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import fetch_tone_guidance
from app.db.connection import fetch_tone_guidance, get_agent_prompt


class MoodClassification(BaseModel):
    mood: str = Field(description="One of: positive, negative, neutral")


MOOD_SYSTEM_PROMPT_DEFAULT = """Classify the emotional tone of the visitor's latest message
as exactly one of: positive, negative, neutral.

- positive: enthusiastic, excited, clearly upbeat
- negative: stressed, frustrated, describing a difficult situation, dissatisfied
- neutral: matter-of-fact, browsing, no strong emotion either way

Judge only the latest message, in light of the conversation so far."""


def classify_mood(text: str) -> str:
    """Local read of the latest line, so a follow-up does not wait on another model call."""
    lowered = text.lower()
    negative = (
        "disconnect", "low-energy", "low energy", "stress", "frustrat", "exhaust",
        "anxious", "burnout", "stuck", "struggl", "unhappy", "tired", "demotivat", "conflict",
    )
    positive = ("excited", "great", "happy", "wonderful", "eager", "thrilled", "love this")
    if any(word in lowered for word in negative):
        return "negative"
    if any(word in lowered for word in positive):
        return "positive"
    return "neutral"


def run_mood_tone(state: dict) -> dict:
    latest_message = state["messages"][-1]["content"]
    mood = classify_mood(latest_message)

    state["detected_mood"] = mood
    mood_history = state.get("mood_history", [])
    mood_history.append({"turn": state.get("turn_count", 0), "mood": mood})
    state["mood_history"] = mood_history

    # Fetch admin-editable tone guidance + example phrases for this mood
    state["tone_guidance"] = fetch_tone_guidance(mood, state.get("organization_id"))

    return state
