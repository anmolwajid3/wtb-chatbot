"""
LangGraph wiring for the WTB chatbot.

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


class ChatState(TypedDict):
    conversation_id: str
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
    final_reply: str
    quote_summary: str


def _route_after_intent(state: ChatState) -> str:
    return "end_spam" if state.get("outcome") == "spam" else "mood_tone"


def _spam_reply_node(state: ChatState) -> ChatState:
    state["final_reply"] = (
        "Thanks for reaching out! It looks like this message might not be related "
        "to coaching services — if I've misunderstood, feel free to try again "
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
    graph.add_edge("formatter", "guardrail_check")
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

    reply = (
        f"Great choice, {coach_name}'s {program_name} it is. "
        f"Could I get your name and email so our team can follow up directly with next steps?"
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
    )

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "outcome": state["outcome"],
        "detected_mood": state.get("detected_mood", "neutral"),
        "coach_matches": [],
        **_empty_debug_fields(),
    }


OPTIONAL_DETAILS_PROMPT_REPLY = (
    "Perfect, thank you. Just a couple more quick details that'd help our team "
    "prepare, if you have them handy: roughly how many people, what format works "
    "best (in-person, remote, or hybrid), and any scheduling constraints we "
    "should know about? No worries if you'd rather skip this and let the team "
    "sort it out directly."
)

CLOSING_REPLY = (
    "Thank you, that's everything I need. I'll get this over to WTB's team "
    "right away, and they'll be in touch directly to confirm timing and next steps."
)


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
    but that are still genuinely useful for WTB's team to have, and this is
    the natural moment to ask: after commitment, not before it. Round 2
    (whatever they answer, including "skip") closes out and compiles the
    final brief.
    """
    state = _conversations_in_memory[conversation_id]
    state["messages"].append({"role": "user", "content": message})

    turns = state.get("post_selection_turns", 0)

    if turns == 0:
        state["post_selection_turns"] = 1
        reply = OPTIONAL_DETAILS_PROMPT_REPLY
        state["messages"].append({"role": "assistant", "content": reply})
        _conversations_in_memory[conversation_id] = state

        save_conversation_state(
            conversation_id=conversation_id,
            transcript=state["messages"],
            outcome=state["outcome"],
            matched_coach_ids=state.get("matched_coaches", []),
            mood_history=state.get("mood_history", []),
        )

        return {
            "conversation_id": conversation_id,
            "reply": reply,
            "outcome": state["outcome"],
            "detected_mood": state.get("detected_mood", "neutral"),
            "coach_matches": [],
            **_empty_debug_fields(),
        }

    # turns >= 1: whatever they just said (real details, or "skip") is the
    # last piece — compile the final brief now.
    result_state = run_summarizer(state)

    reply = CLOSING_REPLY
    result_state["messages"].append({"role": "assistant", "content": reply})
    result_state["final_reply"] = reply
    _conversations_in_memory[conversation_id] = result_state

    save_conversation_state(
        conversation_id=conversation_id,
        transcript=result_state["messages"],
        outcome=result_state["outcome"],
        matched_coach_ids=result_state.get("matched_coaches", []),
        mood_history=result_state.get("mood_history", []),
    )

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "outcome": result_state["outcome"],
        "detected_mood": result_state.get("detected_mood", "neutral"),
        "coach_matches": [],
        **_empty_debug_fields(),
    }


def run_turn(conversation_id: str | None, message: str, selected_coach_id: str | None = None) -> dict:
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
        return _handle_coach_selection(conversation_id, selected_coach_id)

    if conversation_id and conversation_id in _conversations_in_memory:
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
            "outcome": "in_progress",
            "draft_reply": "",
            "guardrail_violated": False,
            "guardrail_which_rule": None,
            "guardrail_regex_flagged": False,
            "review_passed": True,
            "review_issues": [],
            "safety_loop_count": 0,
            "safety_fallback_used": False,
            "final_reply": "",
            "quote_summary": "",
        }
    else:
        state = _conversations_in_memory[conversation_id]

    state["messages"].append({"role": "user", "content": message})

    graph = get_compiled_graph()
    result_state = graph.invoke(state)

    result_state["messages"].append({"role": "assistant", "content": result_state["final_reply"]})
    _conversations_in_memory[conversation_id] = result_state

    # Persist to Postgres after every turn so nothing is lost and the
    # debug/traceability view always reflects the latest state.
    save_conversation_state(
        conversation_id=conversation_id,
        transcript=result_state["messages"],
        outcome=result_state["outcome"] if result_state["outcome"] != "in_progress" else "in_progress",
        matched_coach_ids=result_state.get("matched_coaches", []),
        mood_history=result_state.get("mood_history", []),
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