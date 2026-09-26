"""
Guardrail-Checking Agent.

Runs on the current candidate reply, before it is ever sent to the user. Uses
a cheap regex pre-filter as a fast first pass, but the real check is a
semantic LLM call — a regex alone would miss phrasing like "around a
thousand euros" (see blueprint Section 10.1).

This node is also the entry point of the Guardrail <-> Response Reviewer
loop: it always re-checks the MOST RECENT candidate text (final_reply if a
previous round already produced one, otherwise the Formatter's original
draft_reply), and increments the shared safety_loop_count each time it runs
so the loop has a hard cap and can't run forever.
"""
import re
from pydantic import BaseModel, Field
from app.llm import get_llm
from app.db.connection import fetch_active_guardrails, fetch_coaches_by_ids, get_agent_prompt

# Fast first-pass filter — catches the obvious cases cheaply, but is NOT
# relied on as the only check.
PRICE_PATTERN = re.compile(r"[€$£]\s?\d|\d+\s?(eur|euros?|dollars?)\b", re.IGNORECASE)

# Visitor asks, including the common misspelling "adivce". This screens the
# request itself. The reply check below only sees what the bot is about to send.
ADVICE_REQUEST = re.compile(
    r"\b(?:medic\w*|legal|health)(?:\W+\w+){0,3}\W+(?:advice|advise|adivce|advive)\b"
    r"|\b(?:advice|advise|adivce|advive)(?:\W+\w+){0,3}\W+(?:medic\w*|legal|health)\b"
    r"|\b(?:diagnos\w*|prescri\w*|medication|dosage|lawsuit)\b",
    re.IGNORECASE,
)


def _medical_legal_rule(rules: list[dict]) -> str | None:
    for rule in rules:
        category = (rule.get("category") or "").lower()
        text = rule.get("rule_text") or ""
        lowered = text.lower()
        if category == "medical-legal" or "medical" in lowered or "legal advice" in lowered:
            return text
    return None


def visitor_advice_rule(text: str, organization_id: str | None) -> str | None:
    """The active medical/legal rule, when this message is asking for that advice."""
    if not ADVICE_REQUEST.search(text or ""):
        return None
    try:
        rules = fetch_active_guardrails(organization_id)
    except Exception:
        rules = [{"rule_text": "Never give medical or legal advice.", "category": "medical-legal"}]
    return _medical_legal_rule(rules)


class GuardrailCheckResult(BaseModel):
    violates: bool = Field(description="True if the draft reply violates any of the provided rules")
    which_rule: str | None = Field(default=None, description="The rule text that was violated, if any")
    suggested_rewrite: str | None = Field(
        default=None,
        description="A corrected version of the reply that removes the violation while keeping "
                    "the rest of the message natural and warm. Only provided if violates=True.",
    )


GUARDRAIL_SYSTEM_PROMPT_DEFAULT = """You are a safety reviewer for a coaching-company chatbot's draft reply.
Check the draft reply against the active rules below. A rule is violated if the
reply makes a price commitment or estimate (including vague phrasing like "around
a thousand euros" or "budget-friendly range" — not just literal currency symbols),
gives medical/legal advice, or mentions a coach/service that is not in the verified profiles.
Offering to have the team send a quote, with no amount and no range, is allowed.

A name or program that appears in the verified profiles is allowed. Do not treat
it as fabricated just because the rule text says not to invent people.

Active rules:
{rules}

Verified profiles:
{profiles}

Draft reply to check:
{draft}
"""

FALLBACK_REPLY = (
    "That's a great question — for exact pricing, our team will follow up directly "
    "with a tailored quote once we understand your needs a bit better. Is there "
    "anything else about the coaching itself I can help with in the meantime?"
)


def _invented_pricing_apology(original: str, rewrite: str) -> bool:
    """A quote offer is fine. A pricing speech is not, when the draft never named a price."""
    if PRICE_PATTERN.search(original or ""):
        return False
    return bool(re.search(r"exact pricing|price range|what it costs", rewrite or "", re.I))


def run_guardrail_check(state: dict) -> dict:
    # Mark that a new round of the guardrail <-> reviewer loop is starting.
    # This is the single place the counter increments, since guardrail_check
    # is always the first node re-entered on every loop iteration.
    state["safety_loop_count"] = state.get("safety_loop_count", 0) + 1

    # Always check the MOST RECENT candidate text. On the first pass through
    # the loop, final_reply hasn't been set yet, so this falls back to the
    # Formatter's original draft_reply — but on any later loop round, this
    # picks up whatever the Response Reviewer just revised, not the stale
    # original draft.
    current_text = state.get("final_reply") or state.get("draft_reply", "")
    if not current_text:
        return state

    rules = fetch_active_guardrails(state.get("organization_id"))
    rule_texts = [r["rule_text"] for r in rules]
    matched_ids = state.get("matched_coaches") or []
    coaches = fetch_coaches_by_ids(matched_ids) if matched_ids else []
    if coaches:
        profiles = "\n".join(
            f"- {c.get('coach_name')} | {c.get('program_name')} | {c.get('short_description') or ''}"
            for c in coaches
        )
    else:
        profiles = "None. The reply must not name a coach, program, or credential."

    # Fast pre-filter (informational only — logged, does not by itself block)
    regex_flagged = bool(PRICE_PATTERN.search(current_text))

    llm = get_llm(temperature=0.0, agent_name="guardrail_check", organization_id=state.get("organization_id"))
    structured_llm = llm.with_structured_output(GuardrailCheckResult)

    prompt_template = get_agent_prompt("guardrail_check", GUARDRAIL_SYSTEM_PROMPT_DEFAULT, state.get("organization_id"))
    try:
        prompt = prompt_template.format(rules=rule_texts, profiles=profiles, draft=current_text)
    except (KeyError, IndexError):
        prompt = GUARDRAIL_SYSTEM_PROMPT_DEFAULT.format(rules=rule_texts, profiles=profiles, draft=current_text)
    if "{profiles}" not in prompt_template:
        prompt += (
            "\n\nVerified profiles the reply may mention. A person or program listed "
            f"here is allowed:\n{profiles}"
        )
    prompt += (
        "\n\nA reply that offers a quote request without stating an amount or a range "
        "does not violate the pricing rule."
    )
    result: GuardrailCheckResult = structured_llm.invoke([{"role": "system", "content": prompt}])

    state["guardrail_regex_flagged"] = regex_flagged
    state["guardrail_violated"] = result.violates
    state["guardrail_which_rule"] = result.which_rule

    if result.violates:
        if result.suggested_rewrite:
            # Re-check the rewrite once before trusting it
            try:
                recheck_prompt = prompt_template.format(
                    rules=rule_texts, profiles=profiles, draft=result.suggested_rewrite
                )
            except (KeyError, IndexError):
                recheck_prompt = GUARDRAIL_SYSTEM_PROMPT_DEFAULT.format(
                    rules=rule_texts, profiles=profiles, draft=result.suggested_rewrite
                )
            recheck: GuardrailCheckResult = structured_llm.invoke([{"role": "system", "content": recheck_prompt}])
            if not recheck.violates and not _invented_pricing_apology(current_text, result.suggested_rewrite):
                state["final_reply"] = result.suggested_rewrite
                state["guardrail_violated"] = False
                state["guardrail_which_rule"] = None
            elif PRICE_PATTERN.search(current_text):
                state["final_reply"] = FALLBACK_REPLY
            else:
                # A quote offer is not a price. Don't replace the real reply
                # with a pricing apology the visitor never asked for.
                state["final_reply"] = current_text
                state["guardrail_violated"] = False
                state["guardrail_which_rule"] = None
        elif PRICE_PATTERN.search(current_text):
            state["final_reply"] = FALLBACK_REPLY
        else:
            state["final_reply"] = current_text
            state["guardrail_violated"] = False
            state["guardrail_which_rule"] = None
    else:
        state["final_reply"] = current_text

    return state