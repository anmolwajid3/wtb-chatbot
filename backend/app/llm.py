"""
Single shared LLM client factory used by every agent node.

The model is read from the database (set via the admin panel's LLM
Settings page) instead of a fixed environment variable, so switching
models takes effect on the next request with no redeploy. Every call
also attaches a usage-logging callback that records real cost when
OpenRouter provides it, and falls back to an estimate otherwise.
"""
import os
from langchain_openai import ChatOpenAI
from langchain_core.callbacks import BaseCallbackHandler
from app.db.connection import get_active_model, get_llm_pricing, log_llm_usage


class UsageLoggingHandler(BaseCallbackHandler):
    """
    Fires after every completed LLM call; logs usage, never raises.

    Prefers OpenRouter's own reported cost (the same real dollar figure shown
    on OpenRouter's own dashboard) over our own price-table estimate. This
    requires requesting usage accounting via extra_body below — if that ever
    stops working (API change, provider that doesn't support it, etc.), this
    silently falls back to the estimate rather than losing data entirely.
    """

    def __init__(self, agent_name: str, model: str):
        self.agent_name = agent_name
        self.model = model

    def on_llm_end(self, response, **kwargs):
        try:
            usage = {}
            if response.llm_output:
                usage = response.llm_output.get("token_usage") or response.llm_output.get("usage") or {}
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            if not input_tokens and not output_tokens:
                return  # some providers/paths don't return usage data — nothing to log

            real_cost = usage.get("cost")  # OpenRouter-specific: actual dollars for this exact call
            if real_cost is not None:
                log_llm_usage(self.agent_name, self.model, input_tokens, output_tokens, float(real_cost), is_actual=True)
            else:
                price = get_llm_pricing(self.model)
                estimated_cost = (input_tokens / 1_000_000) * price["input"] + (output_tokens / 1_000_000) * price["output"]
                log_llm_usage(self.agent_name, self.model, input_tokens, output_tokens, estimated_cost, is_actual=False)
        except Exception:
            # Usage logging must never be able to break the actual chatbot request.
            pass


def get_llm(temperature: float = 0.0, agent_name: str = "unknown") -> ChatOpenAI:
    """
    Returns a configured chat client pointed at OpenRouter.

    agent_name identifies which agent is making the call, purely for cost
    attribution in the usage log — it has no effect on model behavior.

    temperature=0.0 is the default because most agents in this system
    (matching, guardrail-checking, extraction) need deterministic,
    non-creative behavior. Pass a higher temperature explicitly only
    for the formatter node, where some natural variation in phrasing
    is desirable.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    base_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    model = get_active_model()

    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY must be set in your .env file. "
            "Copy .env.example to .env and fill in real values."
        )

    handler = UsageLoggingHandler(agent_name, model)

    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        callbacks=[handler],
        extra_body={"usage": {"include": True}},  # ask OpenRouter to include real per-call cost
    )