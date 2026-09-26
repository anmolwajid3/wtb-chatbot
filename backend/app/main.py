from dotenv import load_dotenv

load_dotenv()  # must happen before anything reads os.environ, hence first import

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.diagnose import run_diagnosis
from app.graph import run_turn
from app.db.connection import (
    resolve_organization_id,
    fetch_organization_status,
    fetch_public_company,
    take_message_credit,
)

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


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    outcome: str
    detected_mood: str
    coach_matches: list[dict]
    debug_turn_count: int
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
    result = run_turn(
        request.conversation_id,
        request.message,
        request.selected_coach_id,
        organization_id,
    )
    return ChatResponse(**result)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/company")
def company(organization_slug: str | None = None):
    record = fetch_public_company(organization_slug)
    if not record:
        return {"name": None, "slug": None, "profile_label": None, "profile_label_plural": None, "logo_url": None}
    return record


@app.get("/greeting")
def greeting(organization_slug: str | None = None):
    from app.db.connection import fetch_random_greeting
    organization_id = resolve_organization_id(organization_slug)
    return {"greeting": fetch_random_greeting(organization_id)}