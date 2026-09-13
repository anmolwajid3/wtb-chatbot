"""
Standalone diagnostic: tests ONLY the is_off_topic classification, completely
outside the normal conversation pipeline. This isolates whether the model
itself is returning False for this message, or whether something else in
the pipeline (state handling, agent wiring, etc.) is the actual problem.
"""
from dotenv import load_dotenv
load_dotenv()

from app.llm import get_llm
from app.db.connection import get_agent_prompt
from app.agents.intent_router import IntakeExtraction, INTAKE_SYSTEM_PROMPT_DEFAULT

# Pull the ACTUAL currently-live prompt, exactly as the real pipeline would
system_prompt = get_agent_prompt("intent_router", INTAKE_SYSTEM_PROMPT_DEFAULT)

print("=" * 60)
print("ACTUAL PROMPT BEING USED RIGHT NOW:")
print("=" * 60)
print(system_prompt)
print("=" * 60)

llm = get_llm(temperature=0.0, agent_name="intent_router_test")
structured_llm = llm.with_structured_output(IntakeExtraction)

test_message = "my cat is dead"

result = structured_llm.invoke([
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": test_message},
])

print()
print(f"Test message: {test_message!r}")
print(f"is_spam: {result.is_spam}")
print(f"is_off_topic: {result.is_off_topic}")
print(f"theme: {result.theme}")
print(f"need_description: {result.need_description}")