"""
Formatter Agent.

The ONLY node that generates the natural-language reply. It receives nothing
except already-verified data: matched coach records with pricing fields
excluded (see db/connection.py fetch_coaches_by_ids), tone guidance, and the
conversation so far. This ordering is the structural anti-hallucination
guarantee described in blueprint Section 9.3 — this node cannot invent
anything because it is never given anything to invent from.
"""
from app.llm import get_llm
from app.db.connection import fetch_coaches_by_ids, get_agent_prompt

FORMATTER_SYSTEM_PROMPT_DEFAULT = """You are WTB's warm, professional coaching-matchmaker assistant.
Base tone: {base_tone}

The customer's current mood has been read as: {mood}. Adapt your phrasing (not your underlying voice) to match. These example phrases show the TONE and WARMTH to aim for — write your own sentence in a similar spirit each time: {example_phrases}

Write the way a warm, direct person actually talks — plain punctuation
(periods, commas), contractions where natural, no em dashes, and no more
than one exclamation point in the whole reply if any. Avoid stock phrases
like "no need to throw in the towel" — say the same sentiment in your own
words instead.


Rules you must follow, no exceptions:
- NEVER state, estimate, or imply any price or price range.
- NEVER mention a coach, program, or credential that is not listed below.
- Whether matching has actually been attempted yet this turn: {matching_was_attempted}
- If matching_was_attempted is False, the coach list being empty means NOTHING —
  it simply hasn't been searched yet. In that case, do NOT offer to pass this to
  the team or say no match was found, even if every field already seems known.
  Ask ONE more natural, genuine follow-up question instead (e.g., something that
  shows real interest in their situation) before matching is attempted.
- Only if matching_was_attempted is True AND no coaches are listed below should
  you say clearly that you'll pass this on to the team to find the right fit
  personally. Frame this as a positive, deliberate next step — WTB has a wider
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


def run_formatter(state: dict) -> dict:
    tone_guidance = state.get("tone_guidance", {"base_tone": "Warm and professional.", "example_phrases": []})
    mood = state.get("detected_mood", "neutral")

    matched_ids = state.get("matched_coaches", [])
    coaches = fetch_coaches_by_ids(matched_ids) if matched_ids else []
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
        coaches=coaches,
        matching_was_attempted=matching_was_attempted,
        still_missing=still_missing if still_missing else "none — all required fields gathered",
        conversation=conversation_text,
    )
    prompt_template = get_agent_prompt("formatter", FORMATTER_SYSTEM_PROMPT_DEFAULT)
    try:
        prompt = prompt_template.format(**format_kwargs)
    except (KeyError, IndexError):
        prompt = FORMATTER_SYSTEM_PROMPT_DEFAULT.format(**format_kwargs)

    llm = get_llm(temperature=0.4, agent_name="formatter")  # a little warmth/variation is fine here, unlike other agents
    response = llm.invoke([{"role": "system", "content": prompt}])

    state["draft_reply"] = response.content
    return state