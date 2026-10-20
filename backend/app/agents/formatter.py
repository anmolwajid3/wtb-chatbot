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

Reply language (mandatory): {reply_language_name}.
Write EVERY sentence of your reply in that language only. Do not mix languages.

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

_LOCALE_NAME = {"fi": "Finnish", "en": "English"}

_COPY = {
    "fi": {
        "advice": "En voi antaa lääketieteellistä tai juridista neuvontaa.",
        "advice_ask_team": "Jos etsit valmentajaa, kerro mitä tiimissä tapahtuu?",
        "advice_ask_timing": "Milloin tämän olisi hyvä alkaa?",
        "offtopic": "Tämä on asian ulkopuolella tässä chatissa.",
        "price_need_fit": "En voi puhua hinnasta ennen kuin tiedän tarpeen. Mitä tiimissä on meneillään?",
        "price_ask_timing": "En voi antaa hintoja tässä — tiimi lähettää tarjouksen, kun sopivuus on selvillä. Milloin tämän olisi hyvä alkaa?",
        "price_quote": "En voi antaa hintoja tässä — tiimi liittää ne mukaan, kun he ottavat yhteyttä.",
        "ask_situation": "Kerro omin sanoin, mitä on meneillään?",
        "ask_timing": "Milloin tämän olisi hyvä alkaa?",
        "got_timing": "Selvä — {theme}. Milloin tämän olisi hyvä alkaa?",
        "one_more": "Ennen kuin ehdotan ketään, onko vielä yksi yksityiskohta siitä, miten tämä näkyy tiimissä?",
    },
    "en": {
        "advice": "I can't give medical or legal advice.",
        "advice_ask_team": "If you want help finding a coach, what's going on with the team?",
        "advice_ask_timing": "When would you want this to start?",
        "offtopic": "That's outside what I can help with here.",
        "price_need_fit": "I can't talk about price until I know the fit. What's going on with the team?",
        "price_ask_timing": "I can't give prices here — the team sends a quote once we know the fit. When would you want this to start?",
        "price_quote": "I can't give prices here — the team includes that in the quote when they follow up.",
        "ask_situation": "What's going on, in your own words?",
        "ask_timing": "When would you want this to start?",
        "got_timing": "Got it — {theme}. When would you want this to start?",
        "one_more": "Before I suggest anyone, is there one more detail about how this is showing up for the team?",
    },
}


def _locale(state: dict | None = None) -> str:
    loc = (state or {}).get("reply_locale") or "en"
    return loc if loc in _COPY else "en"


def _t(key: str, locale: str, **kwargs) -> str:
    if locale == "sv":
        locale = "fi"
    text = _COPY.get(locale, _COPY["fi"]).get(key) or _COPY["fi"][key]
    return text.format(**kwargs) if kwargs else text


def _price_question(text: str) -> bool:
    return bool(re.search(r"\b(price|pricing|cost|how much|fee|fees|hinta|kustannus|pris)\b", text, re.I))


def boundary_reply(slots: dict, lead_key: str, locale: str = "en") -> str:
    """Refuse or redirect, then ask only the next coaching question still missing."""
    lead = _t(lead_key, locale)
    has_situation = bool(slots.get("theme") or slots.get("need_description"))
    if not has_situation:
        return f"{lead} {_t('advice_ask_team', locale)}"
    if not slots.get("timing"):
        return f"{lead} {_t('advice_ask_timing', locale)}"
    return lead


def follow_up_reply(slots: dict, latest_user: str, locale: str = "en") -> str | None:
    """One next question. None means the conversation is ready for a real match."""
    has_situation = bool(slots.get("theme") or slots.get("need_description"))

    if _price_question(latest_user):
        if not has_situation:
            return _t("price_need_fit", locale)
        if not slots.get("timing"):
            return _t("price_ask_timing", locale)
        return _t("price_quote", locale)

    if not has_situation:
        return _t("ask_situation", locale)
    if not slots.get("timing"):
        if slots.get("theme"):
            return _t("got_timing", locale, theme=str(slots["theme"])[:60].rstrip("."))
        return _t("ask_timing", locale)
    return None


def run_formatter(state: dict) -> dict:
    latest_user = state["messages"][-1]["content"] if state.get("messages") else ""
    slots = state.get("gathered_slots", {})
    locale = _locale(state)
    if state.get("advice_blocked") or visitor_advice_rule(latest_user, state.get("organization_id")):
        state["advice_blocked"] = True
        reply = boundary_reply(slots, "advice", locale)
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if state.get("off_topic_this_turn"):
        reply = boundary_reply(slots, "offtopic", locale)
        state["draft_reply"] = reply
        state["final_reply"] = reply
        return state
    if not state.get("ready_to_match"):
        reply = follow_up_reply(slots, latest_user, locale)
        if reply is None:
            reply = _t("one_more", locale)
        # Warm-up path skips the LLM — still apply a mood example phrase as the
        # opening beat so admin phrases actually shape the reply.
        phrases = list((state.get("tone_guidance") or {}).get("example_phrases") or [])
        mood = state.get("detected_mood") or "neutral"
        if phrases and mood in {"negative", "positive"} and reply:
            opener = phrases[0].strip().rstrip(".")
            if opener and opener.lower() not in reply.lower():
                reply = f"{opener}. {reply}"
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
        reply_language_name=_LOCALE_NAME.get(locale, "English"),
    )
    prompt_template = get_agent_prompt("formatter", FORMATTER_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(**format_kwargs)
    except (KeyError, IndexError):
        prompt = FORMATTER_SYSTEM_PROMPT_DEFAULT.format(**format_kwargs)
    prompt += (
        "\n\nNEVER give medical or legal advice. If the visitor asked for either, "
        "refuse in one sentence and then continue with the coaching conversation."
        f"\nReply only in {_LOCALE_NAME.get(locale, 'English')}."
    )
    if settings["show_match_score"] and coaches:
        prompt += "\nWhen you name a profile, include its match_score as a percentage."

    llm = get_llm(temperature=0.4, agent_name="formatter", organization_id=state.get("organization_id"))
    response = llm.invoke([{"role": "system", "content": prompt}])

    state["draft_reply"] = response.content
    return state
