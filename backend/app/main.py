from dotenv import load_dotenv

load_dotenv()  # must happen before anything reads os.environ, hence first import

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.graph import run_turn

app = FastAPI(title="WTB Coach-Matching Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = ""
    selected_coach_id: str | None = None


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


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    result = run_turn(request.conversation_id, request.message, request.selected_coach_id)
    return ChatResponse(**result)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/greeting")
def greeting():
    from app.db.connection import fetch_random_greeting
    return {"greeting": fetch_random_greeting()}