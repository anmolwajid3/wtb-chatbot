#!/usr/bin/env bash
# End-to-end Finnish chat smoke test (curl). No browser reload needed.
#
#   cd /Users/scn925/wtb-chatbot
#   chmod +x scripts/e2e_chat_fi.sh
#   ./scripts/e2e_chat_fi.sh
#
# Optional:
#   API_URL=https://opas-api.fly.dev COMPANY=what-the-business ./scripts/e2e_chat_fi.sh

set -euo pipefail

API_URL="${API_URL:-https://opas-api.fly.dev}"
COMPANY="${COMPANY:-what-the-business}"
LOCALE="${LOCALE:-fi}"
CHAT="${API_URL%/}/chat"
TMPDIR_E2E=$(mktemp -d)
trap 'rm -rf "$TMPDIR_E2E"' EXIT

PASS=0
FAIL=0
CID=""

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

chat_turn() {
  local label="$1"
  local msg="$2"
  local expect="$3"
  local pyassert="${4:-pass}"

  local payload_file="$TMPDIR_E2E/payload.json"
  local resp_file="$TMPDIR_E2E/resp.json"
  local assert_file="$TMPDIR_E2E/assert.py"

  CID="$CID" MSG="$msg" COMPANY="$COMPANY" LOCALE="$LOCALE" python3 -c '
import json, os
body = {
  "message": os.environ["MSG"],
  "organization_slug": os.environ["COMPANY"],
  "locale": os.environ["LOCALE"],
}
cid = os.environ.get("CID") or ""
if cid:
  body["conversation_id"] = cid
print(json.dumps(body, ensure_ascii=False))
' > "$payload_file"

  curl -sS -X POST "$CHAT" -H 'Content-Type: application/json' -d @"$payload_file" > "$resp_file"

  printf '%s\n' "$pyassert" > "$assert_file"

  bold "[$label]"
  echo "YOU: $msg"

  if EXPECT="$expect" RESP="$resp_file" ASSERT="$assert_file" CID_OUT="$TMPDIR_E2E/cid" python3 -c '
import json, os, re, sys

d = json.load(open(os.environ["RESP"], encoding="utf-8"))
reply = d.get("reply") or ""
expect = os.environ["EXPECT"]
open(os.environ["CID_OUT"], "w", encoding="utf-8").write(d.get("conversation_id") or "")

print("BOT:", reply)
print("slots:", d.get("debug_gathered_slots"))
print(
  "outcome:", d.get("outcome"),
  "| intake:", d.get("debug_intake_turn_count"),
  "| ready:", d.get("debug_ready_to_match"),
  "| matches:", len(d.get("coach_matches") or []),
)

if "used every message" in reply.lower() or "credit" in reply.lower() and "paused" in reply.lower():
  print("CREDIT LIMIT — raise credits_used/credit_limit for this company in admin, then rerun.")
  sys.exit(4)

if not re.search(expect, reply, re.I | re.S):
  print("REGEX FAIL:", expect)
  sys.exit(2)

code = open(os.environ["ASSERT"], encoding="utf-8").read()
try:
  exec(code, {"d": d, "reply": reply, "re": re})
except Exception as e:
  print("ASSERT FAIL:", e)
  sys.exit(3)
'; then
    CID=$(cat "$TMPDIR_E2E/cid")
    green "PASS"
    PASS=$((PASS + 1))
  else
    CID=$(cat "$TMPDIR_E2E/cid" 2>/dev/null || true)
    red "FAIL"
    python3 -m json.tool < "$resp_file" 2>/dev/null || cat "$resp_file"
    FAIL=$((FAIL + 1))
  fi
  echo
}

bold "=== Opas Finnish E2E ==="
echo "API=$API_URL  company=$COMPANY  locale=$LOCALE"
echo

bold "[health]"
H=$(curl -sS "${API_URL%/}/health")
echo "$H"
if echo "$H" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('status')=='ok'; assert d.get('build'), 'old API — missing build marker'"; then
  green "PASS"; PASS=$((PASS+1))
else
  red "FAIL — redeploy backend until health shows a build marker"; FAIL=$((FAIL+1))
fi
echo

bold "[greeting]"
G=$(curl -sS "${API_URL%/}/greeting?organization_slug=${COMPANY}&locale=fi")
echo "$G"
if echo "$G" | python3 -c "import json,sys,re; g=json.load(sys.stdin).get('greeting') or ''; assert re.search(r'Hei|Terve|Tervetuloa', g), g"; then
  green "PASS"; PASS=$((PASS+1))
else
  red "FAIL"; FAIL=$((FAIL+1))
fi
echo

# --- Conversation A: spam alone ---
CID=""
chat_turn "spam" \
  "Osta nyt!!! alennus 50% klikkaa tästä" \
  "ei näytä liittyvän|palveluihin|kiitos yhteydenotosta" \
  "assert d.get('outcome') == 'spam'
assert not (d.get('debug_gathered_slots') or {}).get('theme')"

# --- Conversation B: legal → price → need → timing → detail ---
CID=""
chat_turn "legal" \
  "Mitä Suomen työlainsäädäntö sanoo naisjohtajuudesta?" \
  "juridista|lääketieteellistä|neuvontaa" \
  "assert not (d.get('debug_gathered_slots') or {}).get('theme')"

chat_turn "price" \
  "Paljonko tämä maksaa?" \
  "hinta|tarjouksen|tarjous|sopivuus|tiimissä|en voi|meneillään|Kerro" \
  "assert d.get('debug_ready_to_match') is False"

chat_turn "need" \
  "Tiimimme on demotivoitunut, noin 12 henkilöä." \
  "Milloin|aloittaa|alkaa|kerro|tiim|yksityiskohta" \
  "slots = d.get('debug_gathered_slots') or {}
assert slots.get('theme') or slots.get('need_description')"

chat_turn "timing" \
  "Haluaisimme aloittaa noin kuukauden päästä." \
  "valment|ohjelm|ehdot|sopiv|Motivation|Sustainable|tiim|yksityiskohta|palaver|energia|John|Mikko|verkosto|Ennen" \
  "slots = d.get('debug_gathered_slots') or {}
assert slots.get('timing'), slots
assert 'Milloin tämän olisi hyvä alkaa' not in reply"

chat_turn "detail" \
  "Ongelma näkyy palavereissa: energia on matala eikä kukaan tartu hommiin." \
  "valment|ohjelm|ehdot|sopiv|Motivation|Sustainable|John|Mikko|tiim|verkosto|yhtee|tarjous|Ennen|yksityiskohta" \
  "assert 'Milloin tämän olisi hyvä alkaa' not in reply
assert 'Osta nyt' not in reply
slots = d.get('debug_gathered_slots') or {}
assert slots.get('timing')"

echo
bold "Result: ${PASS} passed, ${FAIL} failed"
if [[ "$FAIL" -gt 0 ]]; then
  red "FAILED"
  exit 1
fi
green "ALL PASSED"
