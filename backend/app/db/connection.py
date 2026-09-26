"""
Database connection helper. Uses plain psycopg2 with RealDictCursor so query
results come back as dicts (easier to pass straight into LLM prompts as JSON-ish
context) rather than raw tuples.
"""
import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager


@contextmanager
def get_db_connection():
    """
    Usage:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM coaches WHERE is_active = true")
                rows = cur.fetchall()
    """
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be set in your .env file.")

    conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_match_settings(organization_id: str | None = None) -> dict:
    """Company matching rules. Missing columns or an unknown company keep the WTB defaults."""
    defaults = {
        "max_matches": 3,
        "min_match_score": 50,
        "followup_turns": 2,
        "show_match_score": False,
    }
    if not organization_id:
        return defaults
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT max_matches, min_match_score, followup_turns, show_match_score
                    FROM organizations WHERE id = %s
                    """,
                    (organization_id,),
                )
                row = cur.fetchone()
        if not row:
            return defaults
        return {
            "max_matches": int(row["max_matches"] or 3),
            "min_match_score": int(row["min_match_score"] or 50),
            "followup_turns": int(row["followup_turns"] or 2),
            "show_match_score": bool(row["show_match_score"]),
        }
    except Exception:
        return defaults


def fetch_active_coaches(organization_id: str | None = None) -> list[dict]:
    """Returns active profiles for one company, excluding internal-only pricing fields —
    those are fetched separately (fetch_coach_pricing_for_internal_use) and
    must never be handed to the customer-facing formatter agent.
    With no organization id, returns every active profile (single-company setups)."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            sql = """
                SELECT id, coach_name, program_name, short_description, long_description,
                       target_group, suited_situations, key_themes, methods,
                       delivery_format, individual_or_group, group_size_min, group_size_max,
                       duration, main_category, keywords, languages
                FROM coaches
                WHERE is_active = true
            """
            params: list = []
            if organization_id:
                sql += " AND organization_id = %s"
                params.append(organization_id)
            cur.execute(sql, params)
            return list(cur.fetchall())


def fetch_coaches_by_ids(coach_ids: list[str]) -> list[dict]:
    """Same field restriction as fetch_active_coaches — no pricing fields."""
    if not coach_ids:
        return []
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, coach_name, program_name, short_description, long_description,
                target_group, delivery_format, duration, image_urls
                FROM coaches
                WHERE id = ANY(%s::uuid[]) AND is_active = true
                """,
                (coach_ids,),
            )
            return list(cur.fetchall())


def fetch_tone_guidance(situation_type: str, organization_id: str | None = None) -> dict:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if organization_id:
                cur.execute(
                    "SELECT description_text FROM tone_settings WHERE name = 'default_voice' AND organization_id = %s",
                    (organization_id,),
                )
                tone_row = cur.fetchone()
                cur.execute(
                    "SELECT phrase_text FROM example_phrases WHERE situation_type = %s AND is_active = true AND organization_id = %s",
                    (situation_type, organization_id),
                )
                phrases = [r["phrase_text"] for r in cur.fetchall()]
                if not tone_row:
                    cur.execute(
                        "SELECT description_text FROM tone_settings WHERE name = 'default_voice' AND organization_id IS NULL"
                    )
                    tone_row = cur.fetchone()
                if not phrases:
                    cur.execute(
                        "SELECT phrase_text FROM example_phrases WHERE situation_type = %s AND is_active = true AND organization_id IS NULL",
                        (situation_type,),
                    )
                    phrases = [r["phrase_text"] for r in cur.fetchall()]
            else:
                cur.execute(
                    "SELECT description_text FROM tone_settings WHERE name = 'default_voice'"
                )
                tone_row = cur.fetchone()
                cur.execute(
                    "SELECT phrase_text FROM example_phrases WHERE situation_type = %s AND is_active = true",
                    (situation_type,),
                )
                phrases = [r["phrase_text"] for r in cur.fetchall()]

    return {
        "base_tone": tone_row["description_text"] if tone_row else "Warm and professional.",
        "example_phrases": phrases,
    }


def _dedupe_rules(rows: list[dict]) -> list[dict]:
    """Repeated seeds of the same rule would otherwise drown the checker."""
    seen = set()
    unique = []
    for row in rows:
        key = ((row.get("category") or "").strip().lower(), (row.get("rule_text") or "").strip())
        if not key[1] or key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def fetch_active_guardrails(organization_id: str | None = None) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if organization_id:
                cur.execute(
                    "SELECT rule_text, category FROM guardrails WHERE is_active = true AND organization_id = %s",
                    (organization_id,),
                )
                rows = list(cur.fetchall())
                if rows:
                    return _dedupe_rules(rows)
                cur.execute(
                    "SELECT rule_text, category FROM guardrails WHERE is_active = true AND organization_id IS NULL"
                )
                return _dedupe_rules(list(cur.fetchall()))
            cur.execute(
                "SELECT rule_text, category FROM guardrails WHERE is_active = true"
            )
            return _dedupe_rules(list(cur.fetchall()))


def save_conversation_state(conversation_id: str, transcript: list, outcome: str,
                             matched_coach_ids: list, mood_history: list,
                             organization_id: str | None = None) -> None:
    import json
    payload = (conversation_id, json.dumps(transcript), outcome, matched_coach_ids, json.dumps(mood_history))
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO conversations (id, transcript_json, outcome, matched_coach_ids, mood_history, organization_id)
                    VALUES (%s, %s, %s, %s::uuid[], %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        transcript_json = EXCLUDED.transcript_json,
                        outcome = EXCLUDED.outcome,
                        matched_coach_ids = EXCLUDED.matched_coach_ids,
                        mood_history = EXCLUDED.mood_history,
                        organization_id = COALESCE(EXCLUDED.organization_id, conversations.organization_id)
                    """,
                    (*payload, organization_id),
                )
            except Exception as exc:
                if "organization_id" not in str(exc):
                    raise
                conn.rollback()
                cur.execute(
                    """
                    INSERT INTO conversations (id, transcript_json, outcome, matched_coach_ids, mood_history)
                    VALUES (%s, %s, %s, %s::uuid[], %s)
                    ON CONFLICT (id) DO UPDATE SET
                        transcript_json = EXCLUDED.transcript_json,
                        outcome = EXCLUDED.outcome,
                        matched_coach_ids = EXCLUDED.matched_coach_ids,
                        mood_history = EXCLUDED.mood_history
                    """,
                    payload,
                )

def save_quote_request(conversation_id: str, summary_text: str, contact_info: str,
                        is_purchase_order: bool) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quote_requests (conversation_id, summary_text, contact_info, is_purchase_order)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (conversation_id) DO UPDATE SET
                    summary_text = EXCLUDED.summary_text,
                    contact_info = EXCLUDED.contact_info,
                    is_purchase_order = EXCLUDED.is_purchase_order
                """,
                (conversation_id, summary_text, contact_info, is_purchase_order),
            )
def get_active_model(organization_id: str | None = None) -> str:
    """
    Reads the company's chosen model. Falls back to the shared settings row,
    then OPENROUTER_MODEL, so a company that has not chosen yet still runs.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if organization_id:
                try:
                    cur.execute(
                        "SELECT active_model FROM company_llm_settings WHERE organization_id = %s",
                        (organization_id,),
                    )
                    row = cur.fetchone()
                    if row and row["active_model"] and row["active_model"] != "not set":
                        return row["active_model"]
                except Exception:
                    conn.rollback()
            cur.execute("SELECT active_model FROM llm_settings WHERE id = 1")
            row = cur.fetchone()
            if row:
                return row["active_model"]
    return os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-5")


def get_llm_pricing(model: str) -> dict:
    """
    Per-million-token pricing for cost estimation, admin-editable via the
    LLM Settings page (so pricing stays accurate as OpenRouter's published
    rates change, without needing a code deploy). Falls back to a
    conservative default if this specific model has no pricing row yet.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT input_price_per_1m, output_price_per_1m FROM llm_pricing WHERE model = %s",
                (model,),
            )
            row = cur.fetchone()
            if row:
                return {"input": float(row["input_price_per_1m"]), "output": float(row["output_price_per_1m"])}
    return {"input": 3.0, "output": 15.0}

def log_llm_usage(agent_name: str, model: str, input_tokens: int, output_tokens: int, cost: float, is_actual: bool = False, organization_id: str | None = None) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO llm_usage_log (agent_name, model, input_tokens, output_tokens, estimated_cost_usd, is_actual_cost, organization_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (agent_name, model, input_tokens, output_tokens, cost, is_actual, organization_id),
                )
            except Exception as exc:
                if "organization_id" not in str(exc):
                    raise
                conn.rollback()
                cur.execute(
                    """
                    INSERT INTO llm_usage_log (agent_name, model, input_tokens, output_tokens, estimated_cost_usd, is_actual_cost)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (agent_name, model, input_tokens, output_tokens, cost, is_actual),
                )
def get_agent_prompt(agent_name: str, default: str, organization_id: str | None = None) -> str:
    """
    Returns the admin-edited prompt for this agent if one exists in the
    database, otherwise falls back to the hardcoded default baked into the
    agent's own file. This fallback is the safety net: if the admin-edited
    text is missing, empty, or the database is unreachable, the bot keeps
    working with the known-good original prompt rather than breaking.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if organization_id:
                    cur.execute(
                        "SELECT system_prompt FROM company_agent_prompts WHERE agent_name = %s AND organization_id = %s",
                        (agent_name, organization_id),
                    )
                    row = cur.fetchone()
                    if row and row["system_prompt"] and row["system_prompt"].strip():
                        return row["system_prompt"]
                cur.execute("SELECT system_prompt FROM agent_prompts WHERE agent_name = %s", (agent_name,))
                row = cur.fetchone()
                if row and row["system_prompt"] and row["system_prompt"].strip():
                    return row["system_prompt"]
    except Exception:
        pass
    return default


def save_agent_prompt(agent_name: str, system_prompt: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_prompts (agent_name, system_prompt, updated_at)
                VALUES (%s, %s, now())
                ON CONFLICT (agent_name) DO UPDATE SET system_prompt = %s, updated_at = now()
                """,
                (agent_name, system_prompt, system_prompt),
            )


def reset_agent_prompt(agent_name: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM agent_prompts WHERE agent_name = %s", (agent_name,))
DEFAULT_GREETING = (
    "Hi! Tell me a bit about what you're looking for — a theme, a situation, "
    "a team size, whatever comes to mind — and I'll help point you to the right fit."
)


def take_message_credit(organization_id: str | None) -> bool:
    """One visitor message costs one credit. Returns false when the month's allowance is gone."""
    if not organization_id or organization_id == "00000000-0000-0000-0000-000000000000":
        return True
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE organizations
                    SET credits_used = 0, credits_period_start = date_trunc('month', now())
                    WHERE id = %s AND credits_period_start < date_trunc('month', now())
                    """,
                    (organization_id,),
                )
                cur.execute(
                    """
                    UPDATE organizations
                    SET credits_used = credits_used + 1
                    WHERE id = %s AND credits_used < credit_limit
                    RETURNING credits_used
                    """,
                    (organization_id,),
                )
                return cur.fetchone() is not None
    except Exception:
        return True


def fetch_organization_status(organization_id: str | None) -> str:
    if not organization_id or organization_id == "00000000-0000-0000-0000-000000000000":
        return "missing"
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT status FROM organizations WHERE id = %s", (organization_id,))
                row = cur.fetchone()
                return row["status"] if row and row.get("status") else "active"
    except Exception:
        return "active"


def fetch_public_company(slug: str | None) -> dict | None:
    """Name and label the visitor widget may show. No internal fields."""
    if not slug:
        return None
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT name, slug, profile_label, profile_label_plural, logo_url
                    FROM organizations
                    WHERE slug = %s AND COALESCE(status, 'active') = 'active'
                    """,
                    (slug,),
                )
                row = cur.fetchone()
                return dict(row) if row else None
    except Exception:
        return None


def resolve_organization_id(slug: str | None) -> str | None:
    """Maps a company slug to its id. Unknown slugs match nothing.
    Missing tables (before migration) fall back to an unscoped conversation."""
    if not slug:
        return None
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM organizations WHERE slug = %s", (slug,))
                row = cur.fetchone()
                if row:
                    return str(row["id"])
                return "00000000-0000-0000-0000-000000000000"
    except Exception:
        return None


def fetch_random_greeting(organization_id: str | None = None) -> str:
    """
    Picks one random active greeting for a fresh conversation. Falls back to
    the original hardcoded default if the table is empty, has no active
    rows, or the database is unreachable — the widget should never show
    nothing, or an error, where a greeting is expected.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if organization_id:
                    cur.execute(
                        """
                        SELECT greeting_text FROM opening_greetings
                        WHERE is_active = true AND organization_id = %s
                        ORDER BY random() LIMIT 1
                        """,
                        (organization_id,),
                    )
                    row = cur.fetchone()
                    if not row:
                        cur.execute(
                            """
                            SELECT greeting_text FROM opening_greetings
                            WHERE is_active = true AND organization_id IS NULL
                            ORDER BY random() LIMIT 1
                            """
                        )
                        row = cur.fetchone()
                else:
                    cur.execute(
                        "SELECT greeting_text FROM opening_greetings WHERE is_active = true ORDER BY random() LIMIT 1"
                    )
                    row = cur.fetchone()
                if row and row["greeting_text"]:
                    return row["greeting_text"]
    except Exception:
        pass
    return DEFAULT_GREETING