from dotenv import load_dotenv

load_dotenv()  # must happen before anything reads os.environ, hence first import

import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.diagnose import run_diagnosis
from app.graph import run_turn
from app.db.connection import (
    resolve_organization_id,
    fetch_organization_status,
    fetch_public_company,
    fetch_company_chat_settings,
    take_message_credit,
)


def _detect_message_locale(text: str) -> str | None:
    """Best-effort locale from the visitor's words (Finnish / Swedish markers)."""
    if not text:
        return None
    lower = text.lower()
    if re.search(
        r"[äöå]|(\b(mitä|meidän|tiimi|haluaisimme|paljonko|kerro|kiitos|hei|kuukauden)\b)",
        lower,
    ):
        # Swedish also uses å/ä/ö — prefer FI when clear Finnish function words appear.
        return "fi"
    return None


app = FastAPI(title="Opas")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class DiagnoseRequest(BaseModel):
    organization_slug: str


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = ""
    selected_coach_id: str | None = None
    organization_slug: str | None = None
    locale: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    outcome: str
    detected_mood: str
    coach_matches: list[dict]
    debug_turn_count: int
    debug_intake_turn_count: int = 0
    debug_example_phrases: list[str] = []
    debug_gathered_slots: dict
    debug_ready_to_match: bool
    debug_guardrail_violated: bool
    debug_guardrail_which_rule: str | None
    debug_review_passed: bool
    debug_review_issues: list[str]
    debug_safety_loop_count: int
    debug_safety_fallback_used: bool
    debug_off_topic_detected: bool


@app.post("/diagnose")
def diagnose(request: DiagnoseRequest):
    organization_id = resolve_organization_id(request.organization_slug)
    if not organization_id or organization_id == "00000000-0000-0000-0000-000000000000":
        return {"checks": [{"name": "Company", "level": "fail", "agent": "—", "detail": "That company was not found."}]}
    return {"checks": run_diagnosis(organization_id)}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    organization_id = resolve_organization_id(request.organization_slug)
    status = fetch_organization_status(organization_id) if organization_id else "active"
    if status in {"archived", "held", "removed", "missing"} and request.organization_slug:
        return ChatResponse(
            conversation_id=request.conversation_id or "",
            reply="This company's assistant is paused. Nothing was removed, and your message was not stored as a new match.",
            outcome="in_progress",
            detected_mood="neutral",
            coach_matches=[],
            debug_turn_count=0,
            debug_gathered_slots={},
            debug_ready_to_match=False,
            debug_guardrail_violated=False,
            debug_guardrail_which_rule=None,
            debug_review_passed=True,
            debug_review_issues=[],
            debug_safety_loop_count=0,
            debug_safety_fallback_used=False,
            debug_off_topic_detected=False,
        )
    if organization_id and not take_message_credit(organization_id):
        return ChatResponse(
            conversation_id=request.conversation_id or "",
            reply="This company has used every message included in its plan for this month. The assistant is paused so a public bot cannot keep spending. Nothing was stored.",
            outcome="in_progress",
            detected_mood="neutral",
            coach_matches=[],
            debug_turn_count=0,
            debug_gathered_slots={},
            debug_ready_to_match=False,
            debug_guardrail_violated=False,
            debug_guardrail_which_rule=None,
            debug_review_passed=True,
            debug_review_issues=[],
            debug_safety_loop_count=0,
            debug_safety_fallback_used=False,
            debug_off_topic_detected=False,
        )
    chat_settings = fetch_company_chat_settings(organization_id)
    forced = (chat_settings.get("reply_language") or "auto").lower()
    if forced == "sv":
        forced = "fi"
    visitor_locale = (request.locale or "fi").lower()
    if visitor_locale == "sv":
        visitor_locale = "fi"
    if forced in {"en", "fi"}:
        reply_locale = forced
    else:
        # Auto: prefer the visitor toggle; Finnish writing wins even if UI is English.
        detected = _detect_message_locale(request.message or "")
        if detected:
            reply_locale = detected
        elif visitor_locale in {"en", "fi"}:
            reply_locale = visitor_locale
        else:
            reply_locale = "fi"

    result = run_turn(
        request.conversation_id,
        request.message,
        request.selected_coach_id,
        organization_id,
        reply_locale=reply_locale,
    )
    return ChatResponse(**result)


@app.get("/health")
def health():
    # build marker so you can confirm a redeploy actually landed
    return {"status": "ok", "build": "fi-light-no-echo-v1"}

@app.get("/company")
def company(organization_slug: str | None = None):
    record = fetch_public_company(organization_slug)
    if not record:
        return {"name": None, "slug": None, "profile_label": None, "profile_label_plural": None, "logo_url": None}
    return record


@app.get("/greeting")
def greeting(organization_slug: str | None = None, locale: str | None = None):
    from app.db.connection import fetch_random_greeting
    organization_id = resolve_organization_id(organization_slug)
    chat_settings = fetch_company_chat_settings(organization_id)
    forced = (chat_settings.get("reply_language") or "auto").lower()
    if forced == "sv":
        forced = "fi"
    incoming = (locale or "fi").lower()
    if incoming == "sv":
        incoming = "fi"
    if forced in {"en", "fi"}:
        reply_locale = forced
    elif incoming in {"en", "fi"}:
        reply_locale = incoming
    else:
        reply_locale = "fi"
    return {"greeting": fetch_random_greeting(organization_id, reply_locale), "locale": reply_locale}