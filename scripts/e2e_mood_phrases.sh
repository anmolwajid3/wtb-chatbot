#!/usr/bin/env bash
# Test mood detection + that company example phrases are loaded for each mood.
#
# Prerequisites:
#   1. Run scripts/seed_example_phrases.sql in Supabase
#   2. Redeploy API so build == mood-phrases-v5 (debug_example_phrases + FI mood words)
#   3. Company has message credits left
#
#   ./scripts/e2e_mood_phrases.sh

set -euo pipefail

API_URL="${API_URL:-https://opas-api.fly.dev}"
COMPANY="${COMPANY:-what-the-business}"
LOCALE="${LOCALE:-en}"
CHAT="${API_URL%/}/chat"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
CID=""

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

chat() {
  local label="$1"
  local msg="$2"
  local expect_mood="$3"
  local phrase_marker="$4"

  CID="$CID" MSG="$msg" COMPANY="$COMPANY" LOCALE="$LOCALE" python3 -c '
import json, os
body = {"message": os.environ["MSG"], "organization_slug": os.environ["COMPANY"], "locale": os.environ["LOCALE"]}
if os.environ.get("CID"):
  body["conversation_id"] = os.environ["CID"]
print(json.dumps(body, ensure_ascii=False))
' > "$TMP/payload.json"

  curl -sS -X POST "$CHAT" -H 'Content-Type: application/json' -d @"$TMP/payload.json" > "$TMP/resp.json"

  bold "[$label]"
  echo "YOU: $msg"

  if EXPECT_MOOD="$expect_mood" MARKER="$phrase_marker" RESP_FILE="$TMP/resp.json" CID_OUT="$TMP/cid" python3 -c '
import json, os, sys

d = json.load(open(os.environ["RESP_FILE"], encoding="utf-8"))
reply = d.get("reply") or ""
mood = d.get("detected_mood") or ""
phrases = d.get("debug_example_phrases") or []
expect = os.environ["EXPECT_MOOD"]
marker = os.environ["MARKER"]
open(os.environ["CID_OUT"], "w").write(d.get("conversation_id") or "")

print("BOT:", reply[:240] + ("…" if len(reply) > 240 else ""))
print("detected_mood:", mood)
print("phrases loaded:", len(phrases))
for p in phrases:
  print("  -", p[:90] + ("…" if len(p) > 90 else ""))

if "used every message" in reply.lower():
  print("CREDIT LIMIT — reset credits, then rerun.")
  sys.exit(4)

ok = True
if mood != expect:
  print(f"MOOD FAIL: expected {expect}, got {mood}")
  ok = False

# Phrases for this mood must be loaded (natural snippet from the seed SQL).
joined = "\n".join(phrases).lower()
if marker.lower() not in joined:
  print(f"PHRASE FAIL: expected seeded snippet {marker!r} in loaded phrases.")
  print("Did you run scripts/seed_example_phrases.sql? Is API build mood-phrases-v5+?")
  ok = False
if len(phrases) < 1:
  print("PHRASE FAIL: no example phrases loaded for this mood")
  ok = False

# Soft tone check: do not require verbatim copy (by design).
low = reply.lower()
if expect == "negative" and any(x in low for x in ("love the energy", "exciting direction", "thrilled")):
  print("TONE FAIL: negative mood reply sounds overly chirpy")
  ok = False
if expect == "positive" and any(x in low for x in ("carrying a tired team", "that sounds draining")):
  print("TONE FAIL: positive mood reply sounds like negative empathy template")
  ok = False

sys.exit(0 if ok else 1)
'; then
    CID=$(cat "$TMP/cid")
    green "PASS"
    PASS=$((PASS + 1))
  else
    rc=$?
    CID=$(cat "$TMP/cid" 2>/dev/null || true)
    red "FAIL"
    python3 -m json.tool < "$TMP/resp.json" 2>/dev/null || cat "$TMP/resp.json"
    FAIL=$((FAIL + 1))
    if [[ "$rc" -eq 4 ]]; then
      red "Aborting — credits exhausted."
      exit 1
    fi
  fi
  echo
}

bold "=== Mood + example phrases E2E ==="
echo "API=$API_URL company=$COMPANY"
echo

H=$(curl -sS "${API_URL%/}/health")
echo "health: $H"
echo "$H" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'mood-phrases' in (d.get('build') or '') or d.get('build'), d" || {
  red "Deploy API with mood-phrases-v5 first (need debug_example_phrases)."
}

# --- Negative path ---
CID=""
chat "neg-open" \
  "Our team feels demotivated and exhausted — I'm honestly frustrated and stuck." \
  "negative" \
  "PHRASE_NEG_"

chat "neg-timing" \
  "We need help for about 12 people, starting in about a month." \
  "neutral" \
  "PHRASE_NEU_"

# --- Positive path (fresh conversation) ---
CID=""
chat "pos-open" \
  "This is exciting! We're thrilled and really looking forward to finding a great coach." \
  "positive" \
  "PHRASE_POS_"

chat "pos-need" \
  "We want team motivation coaching for about 10 people, starting next month." \
  "neutral" \
  "PHRASE_NEU_"

# --- Finnish negative (mood words) ---
CID=""
chat "fi-neg" \
  "Tiimimme on demotivoitunut ja uupunut, energia on matala." \
  "negative" \
  "PHRASE_NEG_"

echo
bold "Result: ${PASS} passed, ${FAIL} failed"
if [[ "$FAIL" -gt 0 ]]; then
  red "FAILED"
  exit 1
fi
green "ALL PASSED"
echo
echo "Note: phrases guide tone; verbatim PHRASE_* markers in the reply are NOT required."
