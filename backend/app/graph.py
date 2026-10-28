"""
LangGraph wiring for the Harbor matching assistant.

Flow (per blueprint Section 9.3 — grounding enforced by node ORDER, not just
prompt wording):

    intent_router -> [spam? end] -> mood_tone -> coach_matcher -> formatter
        -> [ guardrail_check -> response_reviewer ]  <-- loops until clean
        -> summarizer -> END

The Formatter only ever sees verified, pre-filtered data (matched coach IDs
resolved to pricing-free records, admin-controlled tone guidance) — it has
nothing to hallucinate from.

Guardrail Check and Response Reviewer form a genuine loop, not a single pass:
after each one runs, if either found a problem and rewrote the reply, control
goes back to Guardrail Check to re-validate the newest text (since a rewrite
from either agent could reintroduce a problem the other agent would catch).
The loop only exits once one full round comes back completely clean from both
agents, or a safety cap (MAX_SAFETY_ROUNDS) is hit, in which case a fixed
safe fallback reply is used instead — this cap exists purely to guarantee the
request eventually returns even if the model can't converge; it is not a
cost-control measure.
"""
import uuid
import re
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

from app.agents.intent_router import run_intent_router
from app.agents.mood_tone import run_mood_tone
from app.agents.coach_matcher import run_coach_matcher
from app.agents.formatter import run_formatter
from app.agents.guardrail_check import run_guardrail_check
from app.agents.response_reviewer import run_response_reviewer
from app.agents.summarizer import run_summarizer
from app.db.connection import save_conversation_state, fetch_coaches_by_ids
from app.i18n import normalize_locale, t


class ChatState(TypedDict):
    conversation_id: str
    organization_id: str | None
    messages: list  # [{"role": "user"|"assistant", "content": str}]
    turn_count: int
    gathered_slots: dict
    ready_to_match: bool
    detected_mood: str
    mood_history: list
    tone_guidance: dict
    matched_coaches: list
    matched_coach_scores: dict
    coach_selected: bool
    post_selection_turns: int
    outcome: str
    draft_reply: str
    guardrail_violated: bool
    guardrail_which_rule: str | None
    guardrail_regex_flagged: bool
    review_passed: bool
    review_issues: list
    safety_loop_count: int
    safety_fallback_used: bool
    advice_blocked: bool
    off_topic_this_turn: bool
    final_reply: str
    quote_summary: str


def _route_after_intent(state: ChatState) -> str:
    return "end_spam" if state.get("outcome") == "spam" else "mood_tone"


def _spam_reply_node(state: ChatState) -> ChatState:
    state["final_reply"] = (
        "Thanks for reaching out! It looks like this message might not be related "
        "to these services — if I've misunderstood, feel free to try again "
        "describing what you're looking for."
    )
    return state


# Safety valve only — NOT a cost control. Without some cap, a genuinely
# non-converging model would leave a request hanging forever with no reply
# ever reaching the visitor, which is strictly worse than a generic fallback.
MAX_SAFETY_ROUNDS = 5

SAFETY_FALLBACK_REPLY = (
    "Thanks for your patience with this one — let me have a member of our team "
    "follow up with you directly, so you get a properly considered answer rather "
    "than a rushed one."
)


def _route_after_review(state: ChatState) -> str:
    """
    Decides whether this round came back clean from BOTH agents, needs
    another loop, or has hit the safety cap. Kept as a pure decision function
    (no state mutation here) — LangGraph conditional-edge functions only use
    their return value to pick the next node; any state changes belong in an
    actual node, which is why the counter increment lives in guardrail_check
    itself, not here.
    """
    round_is_clean = not state.get("guardrail_violated", False) and state.get("review_passed", True)
    if round_is_clean:
        return "summarizer"
    if state.get("safety_loop_count", 0) >= MAX_SAFETY_ROUNDS:
        # A quality disagreement must not hide a reply the guardrail already accepted.
        if not state.get("guardrail_violated", False):
            return "summarizer"
        return "safety_fallback"
    return "guardrail_check"


def _safety_fallback_node(state: ChatState) -> ChatState:
    state["final_reply"] = SAFETY_FALLBACK_REPLY
    state["safety_fallback_used"] = True
    return state


def build_graph():
    graph = StateGraph(ChatState)

    graph.add_node("intent_router", run_intent_router)
    graph.add_node("end_spam", _spam_reply_node)
    graph.add_node("mood_tone", run_mood_tone)
    graph.add_node("coach_matcher", run_coach_matcher)
    graph.add_node("formatter", run_formatter)
    graph.add_node("guardrail_check", run_guardrail_check)
    graph.add_node("response_reviewer", run_response_reviewer)
    graph.add_node("safety_fallback", _safety_fallback_node)
    graph.add_node("summarizer", run_summarizer)

    graph.set_entry_point("intent_router")

    graph.add_conditional_edges(
        "intent_router",
        _route_after_intent,
        {"end_spam": "end_spam", "mood_tone": "mood_tone"},
    )

    graph.add_edge("end_spam", END)
    graph.add_edge("mood_tone", "coach_matcher")
    graph.add_edge("coach_matcher", "formatter")
    graph.add_conditional_edges(
        "formatter",
        lambda state: "guardrail_check" if state.get("ready_to_match") else "done",
        {"guardrail_check": "guardrail_check", "done": END},
    )
    graph.add_edge("guardrail_check", "response_reviewer")
    graph.add_conditional_edges(
        "response_reviewer",
        _route_after_review,
        {
            "summarizer": "summarizer",
            "guardrail_check": "guardrail_check",  # the actual loop-back edge
            "safety_fallback": "safety_fallback",
        },
    )
    graph.add_edge("safety_fallback", "summarizer")
    graph.add_edge("summarizer", END)

    return graph.compile()


_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


# In-memory conversation store for the pilot. Fine for a single-instance pilot;
# would need a real session store (e.g. a conversations-in-progress table, or
# Redis) if this were ever deployed multi-instance.
_conversations_in_memory: dict[str, ChatState] = {}

def _empty_debug_fields() -> dict:
    """Shared defaults for the debug_* fields on response paths that don't run the full graph."""
    return {
        "debug_turn_count": 0,
        "debug_gathered_slots": {},
        "debug_ready_to_match": False,
        "debug_off_topic_detected": False,
        "debug_guardrail_violated": False,
        "debug_guardrail_which_rule": None,
        "debug_review_passed": True,
        "debug_review_issues": [],
        "debug_safety_loop_count": 0,
        "debug_safety_fallback_used": False,
    }


def _handle_coach_selection(conversation_id: str, selected_coach_id: str) -> dict:
    """
    Handles an explicit "I want this one" click from the widget's coach detail
    view. Deliberately bypasses the LLM pipeline entirely — this is a
    structured UI action with one unambiguous meaning, not free text that
    needs interpretation, so there's nothing for a model to get wrong here.

    Only allows selecting a coach that was actually offered in THIS
    conversation (checked against matched_coaches already in state) — this
    stops a tampered request from claiming a selection of some other coach
    ID that was never actually presented to this visitor.
    """
    state = _conversations_in_memory.get(conversation_id)
    if state is None:
        reply = "This conversation seems to have expired — please start a new one and I'll help you again."
        return {
            "conversation_id": conversation_id,
            "reply": reply,
            "outcome": "in_progress",
            "detected_mood": "neutral",
            "coach_matches": [],
            **_empty_debug_fields(),
        }

    matched_ids = state.get("matched_coaches", [])
    if selected_coach_id not in matched_ids:
        reply = "I couldn't match that selection to what was offered — could you try again?"
        state["messages"].append({"role": "assistant", "content": reply})
        _conversations_in_memory[conversation_id] = state
        return {
            "conversation_id": conversation_id,
            "reply": reply,
            "outcome": state.get("outcome", "in_progress"),
            "detected_mood": state.get("detected_mood", "neutral"),
            "coach_matches": [],
            **_empty_debug_fields(),
        }

    coach_records = fetch_coaches_by_ids([selected_coach_id])
    coach = coach_records[0] if coach_records else {}
    coach_name = coach.get("coach_name", "that coach")
    program_name = coach.get("program_name", "")

    # Narrow down to just the one chosen coach — this is what the Summarizer
    # will compile the quote request against on a later turn. coach_selected
    # locks this in so a later normal message doesn't re-run the matching
    # pipeline and silently overwrite this choice with a fresh match.
    state["matched_coaches"] = [selected_coach_id]
    state["outcome"] = "matched"
    state["coach_selected"] = True
    state["post_selection_turns"] = 0
    state["awaiting_optional_details"] = False
    state["handoff_complete"] = False
    state["session_closed"] = False

    reply = t(
        _locale(state),
        "coach_selected",
        coach_name=coach_name,
        program_name=program_name,
        known=_known_fit_sentence(state),
    )
    state["messages"].append({
        "role": "user",
        "content": f"[Selected {coach_name} — {program_name} from the recommendations]",
    })
    state["messages"].append({"role": "assistant", "content": reply})
    _conversations_in_memory[conversation_id] = state

    save_conversation_state(
        conversation_id=conversation_id,
        transcript=state["messages"],
        outcome=state["outcome"],
        matched_coach_ids=state["matched_coaches"],
        mood_history=state.get("mood_history", []),
        organization_id=state.get("organization_id"),
    )

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "outcome": state["outcome"],
        "detected_mood": state.get("detected_mood", "neutral"),
        "coach_matches": [],
        **_empty_debug_fields(),
    }


_PRICE_ASK = re.compile(
    r"\b(price|pricing|cost|how much|fee|fees|charg\w*|hinta|hinnoittelu|maksaa|kustannus|pris|kostar|kostnad)\b",
    re.I,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_FORMAT = re.compile(
    r"\b("
    r"remote|distributed|virtual|online|hybrid|"
    r"in[- ]person|face[- ]to[- ]face|onsite|on[- ]site|"
    r"lähi|close(?:\s+training)?"
    r")\b",
    re.I,
)
_SCHEDULE = re.compile(
    r"\b("
    r"monday|tuesday|wednesday|thursday|friday|"
    r"weekday|weekdays|weekend|weekends|"
    r"schedule|morning|evening|calendar|"
    r"arkisin|viikonloppu|maanantai|tiistai|keskiviikko|torstai|perjantai"
    r")\b",
    re.I,
)
_ACK = re.compile(
    r"^(okay|ok|okey|okei|thanks|thank you|thx|great|perfect|sounds good|"
    r"got it|cheers|cool|nice|kiitos|joo|selvä|tack)[.!]?$",
    re.I,
)
_BYE = re.compile(
    r"^(bye|goodbye|good bye|see you|cya|later|"
    r"hei hei|moikka|heippa|hejdå|hej då)[.!]?$",
    re.I,
)
_SKIP_OPTIONAL = re.compile(
    r"^(skip|no|nothing|nope|n/a|none|okay|ok|okey|okei|ohita|ei|ei mitään|hoppa)[.!]?$",
    re.I,
)


def _locale(state: dict) -> str:
    return normalize_locale(state.get("locale"))


def _join_phrases(locale: str, items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    conj = {"en": "and", "sv": "och", "fi": "ja"}.get(locale, "and")
    if locale == "en":
        return ", ".join(items[:-1]) + ", and " + items[-1]
    return ", ".join(items[:-1]) + f" {conj} " + items[-1]


def _known_fit_facts(state: dict) -> list[str]:
    locale = _locale(state)
    slots = state.get("gathered_slots") or {}
    need = slots.get("need_description") or ""
    facts = []
    if slots.get("group_size"):
        facts.append(t(locale, "fact_group_size", n=slots["group_size"]))
    if slots.get("timing"):
        facts.append(t(locale, "fact_timing", timing=slots["timing"]))
    found_format = _FORMAT.search(need)
    if found_format:
        word = found_format.group(0).lower().replace("-", " ")
        facts.append("remote" if word in {"distributed", "virtual", "online"} else word)
    return facts


def _known_fit_sentence(state: dict) -> str:
    facts = _known_fit_facts(state)
    if not facts:
        return ""
    return t(_locale(state), "known_fit_prefix", facts=", ".join(facts))


def _missing_optional_details(state: dict) -> list[str]:
    locale = _locale(state)
    slots = state.get("gathered_slots") or {}
    need = slots.get("need_description") or ""
    missing = []
    if not slots.get("group_size"):
        missing.append(t(locale, "optional_group_size"))
    if not _FORMAT.search(need):
        missing.append(t(locale, "optional_format"))
    if not _SCHEDULE.search(need):
        missing.append(t(locale, "optional_schedule"))
    return missing


def _selected_coach(state: dict) -> dict:
    ids = state.get("matched_coaches") or []
    if not ids:
        return {}
    rows = fetch_coaches_by_ids([ids[0]])
    return rows[0] if rows else {}


def _ask_optional_details(state: dict, contact: str, program: str, known: str) -> tuple[str, str]:
    locale = _locale(state)
    missing = _missing_optional_details(state)
    if not missing:
        return t(
            locale,
            "thanks_use_email_only",
            contact=contact,
            program=program,
            known=known,
        ), "close"
    ask = _join_phrases(locale, missing)
    return t(
        locale,
        "thanks_use_email_ask_optional",
        contact=contact,
        program=program,
        known=known,
        ask=ask,
    ), "ask"


def _selection_reply(state: dict, message: str) -> tuple[str, str]:
    """Answer the message in front of us. Returns the reply and stay, ask, or close."""
    locale = _locale(state)
    coach = _selected_coach(state)
    name = coach.get("coach_name") or "that coach"
    program = coach.get("program_name") or "the program"
    known = _known_fit_sentence(state)
    slots = dict(state.get("gathered_slots") or {})
    existing_contact = slots.get("contact")
    fallback_facts = t(locale, "what_you_described")

    if _PRICE_ASK.search(message):
        if existing_contact:
            return (
                f"I can't tell you what {name} charges for {program}. "
                f"The team will include the quote when they write to {existing_contact}.{known}"
            ), "stay"
        return (
            f"I can't tell you what {name} charges for {program}. "
            f"The team puts the number in the quote, so I still need your name and email.{known}"
        ), "stay"

    email = _EMAIL.search(message)
    if email:
        slots["contact"] = email.group(0)
        state["gathered_slots"] = slots
        missing = _missing_optional_details(state)
        if not missing:
            facts = ", ".join(_known_fit_facts(state)) or fallback_facts
            return t(
                locale,
                "thanks_send_close",
                coach_name=name,
                program=program,
                facts=facts,
                contact=email.group(0),
            ), "close"
        return _ask_optional_details(state, email.group(0), program, known)

    # Contact already captured — never re-ask for name/email.
    if existing_contact:
        if not state.get("awaiting_optional_details"):
            missing = _missing_optional_details(state)
            if missing:
                return _ask_optional_details(state, existing_contact, program, known)
            facts = ", ".join(_known_fit_facts(state)) or fallback_facts
            return t(
                locale,
                "thanks_already_have_close",
                contact=existing_contact,
                coach_name=name,
                program=program,
                facts=facts,
            ), "close"
        return t(
            locale,
            "thanks_already_have_stay",
            contact=existing_contact,
            coach_name=name,
            program=program,
            known=known,
        ), "close"

    lowered = message.lower()
    if coach.get("duration") and re.search(r"\b(how long|duration|weeks|length|kauan|kesto)\b", lowered):
        return (
            f"{program} with {name} runs {coach['duration']}.{known} "
            + t(locale, "still_need_contact", coach_name=name, program_name=program, known="")
        ), "stay"
    if coach.get("delivery_format") and re.search(r"\b(remote|hybrid|format|online|in person|in-person|lähi|eta|etä)\b", lowered):
        return (
            f"{name} delivers {program} as {coach['delivery_format']}.{known} "
            + t(locale, "still_need_contact", coach_name=name, program_name=program, known="")
        ), "stay"

    return t(
        locale,
        "still_need_contact",
        coach_name=name,
        program_name=program,
        known=known,
    ), "stay"


def _closing_reply(state: dict, message: str) -> str:
    locale = _locale(state)
    coach = _selected_coach(state)
    name = coach.get("coach_name") or "the coach"
    program = coach.get("program_name") or "the program"
    note = " ".join(message.split())
    if len(note) > 160:
        note = note[:160].rstrip() + "..."
    if _PRICE_ASK.search(message):
        return (
            f"I can't tell you what {name} charges for {program}. "
            f"I'll send what I have to the team and they'll include the quote when they write."
        )
    if _SKIP_OPTIONAL.fullmatch(note):
        facts = ", ".join(_known_fit_facts(state))
        extra = t(locale, "already_have_facts", facts=facts) if facts else ""
        return t(
            locale,
            "skip_optional_close",
            extra=extra,
            coach_name=name,
            program=program,
        )
    return t(
        locale,
        "pass_along",
        coach_name=name,
        program=program,
        note=note,
    )


def _is_closing_ack(message: str) -> bool:
    text = (message or "").strip()
    if not text:
        return False
    if _ACK.fullmatch(text) or _BYE.fullmatch(text):
        return True
    # Short wrap-ups like "ok thanks" / "bye!" after handoff.
    return len(text.split()) <= 2 and bool(
        re.search(r"\b(ok|okay|bye|thanks|thank|kiitos|tack|moikka)\b", text, re.I)
    )


def _post_handoff_reply(state: dict, message: str) -> tuple[str, str]:
    """
    After quote handoff: one short goodbye on ok/bye, then silence.
    Never reopen lead capture or repeat the long "you're all set" loop.
    """
    if state.get("session_closed"):
        return "", "silent"

    locale = _locale(state)
    coach = _selected_coach(state)
    name = coach.get("coach_name") or "the coach"
    program = coach.get("program_name") or "the program"
    contact = (state.get("gathered_slots") or {}).get("contact")
    contact_bit = t(locale, "contact_at", contact=contact) if contact else ""

    if _PRICE_ASK.search(message):
        return (
            f"I can't tell you what {name} charges for {program}. "
            f"The team will include the quote when they write{contact_bit}."
        ), "stay"

    if _is_closing_ack(message):
        return t(locale, "post_handoff_goodbye"), "farewell"

    note = " ".join(message.split())
    if len(note) > 160:
        note = note[:160].rstrip() + "..."
    # Extra detail after handoff is noted once, then the session closes.
    return t(
        locale,
        "post_handoff_add",
        coach_name=name,
        program=program,
        note=note,
        contact_bit=contact_bit,
    ), "farewell"


def _handle_post_selection_message(conversation_id: str, message: str) -> dict:
    """
    Runs once a coach has already been explicitly selected. Deliberately does
    NOT run intent_router/mood_tone/coach_matcher/formatter — that full
    pipeline is what was silently overwriting the customer's explicit choice
    with a fresh, unwanted re-match.

    Two-step wrap-up instead of closing immediately after contact info:
    round 1 (right after contact info is given) asks ONE consolidated,
    explicitly-optional question about group size / format / scheduling —
    details the brief always treated as optional to REQUIRE for matching,
    but that are still genuinely useful for the team to have, and this is
    the natural moment to ask: after commitment, not before it. Round 2
    (whatever they answer, including "skip") closes out and compiles the
    final brief. After that handoff, one short goodbye on ok/bye is allowed;
    further turns stay silent.
    """
    state = _conversations_in_memory[conversation_id]
    state["messages"].append({"role": "user", "content": message})

    if state.get("handoff_complete"):
        reply, mode = _post_handoff_reply(state, message)
    elif _PRICE_ASK.search(message) or _EMAIL.search(message) or not state.get("awaiting_optional_details"):
        reply, mode = _selection_reply(state, message)
    else:
        reply, mode = _closing_reply(state, message), "close"

    if mode == "ask":
        state["awaiting_optional_details"] = True
    if mode == "close":
        state = run_summarizer(state)
        state["awaiting_optional_details"] = False
        state["handoff_complete"] = True
    if mode == "farewell":
        state["session_closed"] = True
        state["handoff_complete"] = True

    if reply:
        state["messages"].append({"role": "assistant", "content": reply})
    state["final_reply"] = reply
    _conversations_in_memory[conversation_id] = state

    save_conversation_state(
        conversation_id=conversation_id,
        transcript=state["messages"],
        outcome=state["outcome"],
        matched_coach_ids=state.get("matched_coaches", []),
        mood_history=state.get("mood_history", []),
        organization_id=state.get("organization_id"),
    )

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "outcome": state["outcome"],
        "detected_mood": state.get("detected_mood", "neutral"),
        "coach_matches": [],
        **_empty_debug_fields(),
    }


def forget_conversation(conversation_id: str) -> None:
    _conversations_in_memory.pop(conversation_id, None)


def run_turn(
    conversation_id: str | None,
    message: str,
    selected_coach_id: str | None = None,
    organization_id: str | None = None,
    record: bool = True,
    locale: str | None = None,
) -> dict:
    locale = normalize_locale(locale)

    if selected_coach_id:
        if not conversation_id:
            return {
                "conversation_id": conversation_id or "",
                "reply": "Please start a conversation before selecting a coach.",
                "outcome": "in_progress",
                "detected_mood": "neutral",
                "coach_matches": [],
                **_empty_debug_fields(),
            }
        if conversation_id in _conversations_in_memory:
            _conversations_in_memory[conversation_id]["locale"] = locale or (
                _conversations_in_memory[conversation_id].get("locale") or "en"
            )
        return _handle_coach_selection(conversation_id, selected_coach_id)

    if conversation_id and conversation_id in _conversations_in_memory:
        _conversations_in_memory[conversation_id]["locale"] = locale or (
            _conversations_in_memory[conversation_id].get("locale") or "en"
        )
        if _conversations_in_memory[conversation_id].get("coach_selected"):
            return _handle_post_selection_message(conversation_id, message)

    if conversation_id is None or conversation_id not in _conversations_in_memory:
        conversation_id = conversation_id or str(uuid.uuid4())
        state: ChatState = {
            "conversation_id": conversation_id,
            "messages": [],
            "turn_count": 0,
            "gathered_slots": {},
            "ready_to_match": False,
            "detected_mood": "neutral",
            "mood_history": [],
            "tone_guidance": {},
            "matched_coaches": [],
            "matched_coach_scores": {},
            "coach_selected": False,
            "post_selection_turns": 0,
            "awaiting_optional_details": False,
            "handoff_complete": False,
            "session_closed": False,
            "outcome": "in_progress",
            "draft_reply": "",
            "guardrail_violated": False,
            "guardrail_which_rule": None,
            "guardrail_regex_flagged": False,
            "review_passed": True,
            "review_issues": [],
            "safety_loop_count": 0,
            "safety_fallback_used": False,
            "advice_blocked": False,
            "off_topic_this_turn": False,
            "final_reply": "",
            "quote_summary": "",
            "organization_id": organization_id,
            "locale": locale,
        }
    else:
        state = _conversations_in_memory[conversation_id]

    state["organization_id"] = organization_id or state.get("organization_id")
    state["locale"] = locale or state.get("locale") or "en"

    state["messages"].append({"role": "user", "content": message})

    graph = get_compiled_graph()
    result_state = graph.invoke(state)

    result_state["messages"].append({"role": "assistant", "content": result_state["final_reply"]})
    _conversations_in_memory[conversation_id] = result_state

    # Persist to Postgres after every turn so nothing is lost and the
    # debug/traceability view always reflects the latest state.
    if record:
        save_conversation_state(
            conversation_id=conversation_id,
            transcript=result_state["messages"],
            outcome=result_state["outcome"] if result_state["outcome"] != "in_progress" else "in_progress",
            matched_coach_ids=result_state.get("matched_coaches", []),
            mood_history=result_state.get("mood_history", []),
            organization_id=result_state.get("organization_id"),
        )

    # Build structured coach match data for the widget's confidence visualization
    # and recommendation cards. This is deliberately assembled fresh here, from
    # the already-verified matched_coaches IDs — never from anything the LLM
    # wrote directly — so the same anti-hallucination guarantee applies here too.
    coach_matches = []
    matched_ids = result_state.get("matched_coaches", [])
    if matched_ids:
        scores = result_state.get("matched_coach_scores", {})
        coach_records = fetch_coaches_by_ids(matched_ids)
        for c in coach_records:
            coach_id = str(c.get("id"))
            image_urls = c.get("image_urls") or []
            coach_matches.append({
                "coach_id": coach_id,
                "coach_name": c.get("coach_name"),
                "program_name": c.get("program_name"),
                "short_description": c.get("short_description"),
                "long_description": c.get("long_description"),
                "target_group": c.get("target_group"),
                "delivery_format": c.get("delivery_format"),
                "duration": c.get("duration"),
                "image_url": image_urls[0] if image_urls else None,
                "match_score": scores.get(coach_id, 50),
            })
        coach_matches.sort(key=lambda m: m["match_score"], reverse=True)

    return {
        "conversation_id": conversation_id,
        "reply": result_state["final_reply"],
        "outcome": result_state["outcome"],
        "detected_mood": result_state["detected_mood"],
        "coach_matches": coach_matches,
        # --- TEMPORARY DEBUG FIELDS — remove once slot-filling behavior is confirmed correct ---
        "debug_turn_count": result_state.get("turn_count", 0),
        "debug_gathered_slots": result_state.get("gathered_slots", {}),
        "debug_ready_to_match": result_state.get("ready_to_match", False),
        "debug_guardrail_violated": result_state.get("guardrail_violated", False),
        "debug_guardrail_which_rule": result_state.get("guardrail_which_rule"),
        "debug_review_passed": result_state.get("review_passed", True),
        "debug_review_issues": result_state.get("review_issues", []),
        "debug_safety_loop_count": result_state.get("safety_loop_count", 0),
        "debug_safety_fallback_used": result_state.get("safety_fallback_used", False),
         "debug_off_topic_detected": result_state.get("off_topic_this_turn", False),
    }