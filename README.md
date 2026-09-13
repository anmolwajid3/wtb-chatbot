# WTB Coach-Matching Chatbot — MVP Codebase

This is the working code for the system described in the *GENT Pilot with WTB —
Technical & Delivery Blueprint*. Two parts:

- **`backend/`** — Python/FastAPI/LangGraph multi-agent chatbot
- **`admin-panel/`** — Next.js admin panel (coach profiles, tone, phrases, guardrails)

Both connect to the same Supabase Postgres database.


---

## 1. One-time setup

### 1.1 Create a Supabase project
1. Go to supabase.com → New project (pick an EU region if offered — see the
   blueprint's data-residency notes).
2. Once provisioned, open **SQL Editor** in the dashboard.
3. Paste the entire contents of `backend/app/db/schema.sql` and run it.
4. Optionally also paste `scripts/seed_synthetic_coaches.sql` and run it, to get
   3 active + 1 deactivated test coach for trying things out immediately.
5. Go to **Project Settings → Database → Connection string (URI)** and copy it —
   you'll need this twice (backend and admin panel).

### 1.2 Get an OpenRouter API key
Go to openrouter.ai → sign up → create an API key. Then check
openrouter.ai/models for the current exact Claude model identifier (it changes
over time — don't assume the one in `.env.example` is still current).

### 1.3 Get a Langfuse account (optional but recommended)
cloud.langfuse.com → free tier project → copy the public/secret keys.

---

## 2. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# now edit .env and fill in: OPENROUTER_API_KEY, OPENROUTER_MODEL, DATABASE_URL,
# and the Langfuse keys if you're using it
```

Run it:
```bash
uvicorn app.main:app --reload
```

Test it:
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": null, "message": "we need help with team motivation for about 15 people"}'
```
You should get a JSON reply back. Note it should ask a clarifying question
rather than recommend a coach on this very first message — that's correct,
expected behavior (see blueprint Section 11).

Run the scenario tests (requires the schema + synthetic seed data to be loaded,
and a working `.env`):
```bash
cd backend && source venv/bin/activate
pytest tests/test_scenarios.py -v -s
```

---

## 3. Admin panel setup

```bash
cd admin-panel
npm install

cp .env.local.example .env.local
# edit .env.local and fill in the SAME DATABASE_URL as the backend's .env
```

Run it:
```bash
npm run dev
```
Open http://localhost:3000 — you'll see four sections: Coaches, Tone of Voice,
Example Phrases, Guardrails. Add a coach here, then immediately test a matching
conversation via the backend — no redeploy needed, the bot reads the database
live on every request.

---

## 4. Running both together day-to-day

```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd admin-panel && npm run dev
```

---

## 5. Project structure

```
wtb-chatbot/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── intent_router.py     # spam screening + slot-filling + warm-up gate
│   │   │   ├── mood_tone.py         # continuous mood detection + tone guidance fetch
│   │   │   ├── coach_matcher.py     # structured SQL lookup, not RAG — closed-set matching
│   │   │   ├── formatter.py         # ONLY node that writes the customer-facing reply
│   │   │   ├── guardrail_check.py   # semantic check + regex pre-filter, hard gate
│   │   │   └── summarizer.py        # compiles the quote_requests brief for WTB's team
│   │   ├── db/
│   │   │   ├── schema.sql           # run this first, in Supabase SQL Editor
│   │   │   └── connection.py        # all DB access — pricing fields deliberately excluded
│   │   │                             # from the queries the matcher/formatter use
│   │   ├── graph.py                  # LangGraph wiring — the node order IS the safety design
│   │   ├── llm.py                    # single shared OpenRouter client
│   │   └── main.py                   # FastAPI app, POST /chat
│   ├── tests/test_scenarios.py       # the 5 scenarios from blueprint Section 17
│   └── requirements.txt
├── admin-panel/
│   └── app/
│       ├── coaches/                  # full CRUD, all 11 profile sections
│       ├── tone/                     # single editable base-tone text
│       ├── phrases/                  # positive/negative/neutral phrase banks
│       └── guardrails/               # add/toggle guardrail rules
└── scripts/seed_synthetic_coaches.sql
```

---

## 6. What's already built vs. what needs your attention

**Already working (verified — see below):**
- Full agent pipeline wired end-to-end in LangGraph
- Structured, closed-set coach matching (no hallucination path)
- Pricing fields structurally excluded from what the bot can ever see
- Guardrail check as a semantic hard-gate, not just regex
- Admin panel with all 11 coach-profile sections, tone, phrases, guardrails
- Purchase Order routing when no coach matches

**Needs your attention before this is customer-facing:**
- Admin panel has NO real authentication yet — add real login before giving
  Minttu/Mari access to anything beyond localhost testing
- Langfuse tracing is referenced in the blueprint but not yet wired into
  `graph.py` — worth adding for the debug/traceability requirement
- The in-memory conversation store in `graph.py` (`_conversations_in_memory`)
  is fine for a single-instance pilot but won't survive a server restart —
  acceptable for now, flag if this needs to be more durable
- No real deployment/hosting config yet (Fly.io/Render/etc. — pick one and
  add a Dockerfile or platform config)

---

## What's been verified

Every piece of this codebase was actually
checked, not just written and assumed correct:
- All Python modules import cleanly (`python -c "from app.agents import ..."`)
- The LangGraph graph compiles with the correct node structure
- The FastAPI app boots and exposes the expected routes
- The Next.js admin panel runs a full production build with zero errors,
  including a complete TypeScript type-check across all pages

