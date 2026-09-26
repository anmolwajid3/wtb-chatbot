"""
Formatter Agent.

The ONLY node that generates the natural-language reply. It receives nothing
except already-verified data: matched coach records with pricing fields
excluded (see db/connection.py fetch_coaches_by_ids), tone guidance, and the
conversation so far. This ordering is the structural anti-hallucination
guarantee described in blueprint Section 9.3 — this node cannot invent
anything because it is never given anything to invent from.
"""
import re
from app.agents.guardrail_check import visitor_advice_rule
from app.llm import get_llm
from app.db.connection import fetch_coaches_by_ids, fetch_match_settings, get_agent_prompt

FORMATTER_SYSTEM_PROMPT_DEFAULT = """You are a warm, professional matchmaker for this company's services.
Base tone: {base_tone}

The customer's current mood has been read as: {mood}. Adapt your phrasing (not your underlying voice) to match. These example phrases show the TONE and WARMTH to aim for — write your own sentence in a similar spirit each time: {example_phrases}

Write the way a warm, direct person actually talks — plain punctuation
(periods, commas), contractions where natural, no em dashes, and no more
than one exclamation point in the whole reply if any. Avoid stock phrases
like "no need to throw in the towel" — say the same sentiment in your own
words instead.


Rules you must follow, no exceptions:
- NEVER state, estimate, or imply any price or price range.
- NEVER give medical or legal advice. If the visitor asks for either, refuse in one sentence and return to finding a coach.
- NEVER mention a coach, program, or credential that is not listed below.
- Whether matching has actually been attempted yet this turn: {matching_was_attempted}
- If matching_was_attempted is False, the coach list being empty means NOTHING —
  it simply hasn't been searched yet. In that case, do NOT offer to pass this to
  the team or say no match was found, even if every field already seems known.
  Ask ONE more natural, genuine follow-up question instead (e.g., something that
  shows real interest in their situation) before matching is attempted.
- Only if matching_was_attempted is True AND no coaches are listed below should
  you say clearly that you'll pass this on to the team to find the right fit
  personally. Frame this as a positive, deliberate next step — the team has a wider
  network than what's searched automatically. Do NOT say or imply "I don't have
  coach information" or anything suggesting a system limitation; this is a
  normal, intentional outcome, not a shortfall.
- If coaches ARE listed below, present 1-3 of them naturally, referencing only
  the fields given. You MUST explicitly state the coach's name (the coach_name
  field) attached to their program by name — never describe a program without
  naming the specific coach who delivers it. For example: "**Team Motivation
  Sprint** with **John Doe** — ..." A reply that mentions a program without
  naming its coach is incomplete, even if everything else about it is accurate.
- If the conversation is not yet warmed up, ask ONE natural clarifying question —
  do not present a form-like list of questions. Specifically, these required
  details are still missing: {still_missing}. Prioritize naturally surfacing
  whichever of those comes up most naturally next — don't re-ask about anything
  already known. Do NOT mention, allude to, or apologize for the coach list
  being empty at this stage — that's expected and invisible to the customer;
  simply ask your question as if coach-matching hasn't been considered yet at all.
- If enough information has been gathered and coach(es) were found, proactively
  and naturally offer to compile a quote request (e.g., "Would you like me to
  put this together as a quote request for you?") rather than waiting to be asked.

Matched coaches (verified, pricing-free — use ONLY this data, nothing else):
{coaches}

Conversation so far:
{conversation}
"""


def _price_question(text: str) -> bool:
    return bool(re.search(r"\b(price|pricing|cost|how much|fee|fees)\b", text, re.I))


def boundary_reply(slots: dict, lead: str) -> str:
    """Refuse or redirect, then ask only the next coaching question still missing."""
    has_situation = bool(slots.get("theme") or slots.get("need_description"))
    if not has_situation:
        return f"{lead} If you want help finding a coach, what's going on with the team?"
    if not slots.get("timing"):
        return f"{lead} When would you want this to start?"
    return lead


def follow_up_reply(slots: dict, latest_user: str) -> str | None:
    """One next question. None means the conversation is ready for a real match."""
    has_situation = bool(slots.get("theme") or slots.get("need_description"))
    if not has_situation:
        if _price_question(latest_user):
            return "I can't talk about price until I know the fit. What's going on with the team?"
        return "What's going on, in your own words?"
    if not slots.get("timing"):
        return "That gives me a real picture. When would you want this to start?"
    return None


def run_formatter(state: dict) -> dict:
    latest_user = state["messages"][-1]["content"] if state.get("messages") else ""
    slots = state.get("gathered_slots", {})
    if state.get("advice_blocked") or visitor_advice_rule(latest_user, state.get("organization_id")):
        state["advice_blocked"] = True
        reply = boundary_reply(slots, "I can't give medical or legal advice.")
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if state.get("off_topic_this_turn"):
        reply = boundary_reply(slots, "That's outside what I can help with here.")
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if not state.get("ready_to_match"):
        reply = follow_up_reply(slots, latest_user)
        if reply is None:
            reply = "Before I suggest anyone, is there one more detail about how this is showing up for the team?"
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state

    tone_guidance = state.get("tone_guidance", {"base_tone": "Warm and professional.", "example_phrases": []})
    mood = state.get("detected_mood", "neutral")

    matched_ids = state.get("matched_coaches", [])
    coaches = fetch_coaches_by_ids(matched_ids) if matched_ids else []
    settings = fetch_match_settings(state.get("organization_id"))
    if settings["show_match_score"]:
        scores = state.get("matched_coach_scores") or {}
        for coach in coaches:
            coach["match_score"] = scores.get(str(coach["id"]))
    matching_was_attempted = bool(state.get("ready_to_match"))

    slots = state.get("gathered_slots", {})
    required_fields = {"theme": "the theme/topic", "need_description": "more detail on the need", "timing": "timing"}
    still_missing = [label for field, label in required_fields.items() if not slots.get(field)]

    conversation_text = "\n".join(
        f"{m['role']}: {m['content']}" for m in state["messages"][-6:]
    )

    format_kwargs = dict(
        base_tone=tone_guidance["base_tone"],
        mood=mood,
        example_phrases=tone_guidance["example_phrases"],
        off_topic=bool(state.get("off_topic_this_turn")),
        coaches=coaches,
        matching_was_attempted=matching_was_attempted,
        still_missing=still_missing if still_missing else "none — all required fields gathered",
        conversation=conversation_text,
    )
    prompt_template = get_agent_prompt("formatter", FORMATTER_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(**format_kwargs)
    except (KeyError, IndexError):
        prompt = FORMATTER_SYSTEM_PROMPT_DEFAULT.format(**format_kwargs)
    prompt += (
        "\n\nNEVER give medical or legal advice. If the visitor asked for either, "
        "refuse in one sentence and then continue with the coaching conversation."
    )
    if settings["show_match_score"] and coaches:
        prompt += "\nWhen you name a profile, include its match_score as a percentage."

    llm = get_llm(temperature=0.4, agent_name="formatter", organization_id=state.get("organization_id"))
    response = llm.invoke([{"role": "system", "content": prompt}])

    state["draft_reply"] = response.content
    return state