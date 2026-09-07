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


def fetch_active_coaches() -> list[dict]:
    """Returns all active coaches, excluding internal-only pricing fields —
    those are fetched separately (fetch_coach_pricing_for_internal_use) and
    must never be handed to the customer-facing formatter agent."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, coach_name, program_name, short_description, long_description,
                       target_group, suited_situations, key_themes, methods,
                       delivery_format, individual_or_group, group_size_min, group_size_max,
                       duration, main_category, keywords, languages
                FROM coaches
                WHERE is_active = true
                """
            )
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


def fetch_tone_guidance(situation_type: str) -> dict:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
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


def fetch_active_guardrails() -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT rule_text, category FROM guardrails WHERE is_active = true"
            )
            return list(cur.fetchall())


def save_conversation_state(conversation_id: str, transcript: list, outcome: str,
                             matched_coach_ids: list, mood_history: list) -> None:
    import json
    with get_db_connection() as conn:
        with conn.cursor() as cur:
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
                (conversation_id, json.dumps(transcript), outcome, matched_coach_ids, json.dumps(mood_history)),
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
def get_active_model() -> str:
    """
    Reads the currently active model from llm_settings, set via the admin
    panel's LLM Settings page. Falls back to the OPENROUTER_MODEL env var
    (and then a hardcoded default) only if the settings row is somehow
    missing, so a fresh/misconfigured database doesn't hard-crash the bot.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
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

def log_llm_usage(agent_name: str, model: str, input_tokens: int, output_tokens: int, cost: float, is_actual: bool = False) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO llm_usage_log (agent_name, model, input_tokens, output_tokens, estimated_cost_usd, is_actual_cost)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (agent_name, model, input_tokens, output_tokens, cost, is_actual),
            )
def get_agent_prompt(agent_name: str, default: str) -> str:
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