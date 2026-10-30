#!/usr/bin/env bash
# ==============================================================================
# GramSahayak — CloudTalk Webhook & Simulator Smoke Test (LD-01)
# Tests Contract Section 7 (Two-stage IVR) & Section 8 (SMS Flow) against :5000
# Usage:
#   bash scripts/test-webhooks.sh [BASE_URL]
#   Default BASE_URL: http://localhost:5000
# ==============================================================================

set -uo pipefail

BASE_URL="${1:-${API_URL:-http://localhost:5000}}"
CALLER_PHONE="+919840033333"
SMS_PHONE="+919829011111"
SESSION_ID="00000000-0000-4000-8000-000000000101"

PASS_COUNT=0
FAIL_COUNT=0

print_result() {
  local label="$1"
  local http_code="$2"
  local body="$3"

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] && echo "$body" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    echo "[PASS] ${label} (HTTP ${http_code})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[FAIL] ${label} (HTTP ${http_code})"
    echo "       Response: ${body}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

run_post() {
  local label="$1"
  local endpoint="$2"
  local payload="$3"

  local response
  response=$(curl -sS -w "\n%{http_code}" \
    -X POST "${BASE_URL}${endpoint}" \
    -H "Content-Type: application/json" \
    -H "x-session-id: ${SESSION_ID}" \
    -d "${payload}" 2>&1 || true)

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  print_result "$label" "$http_code" "$body"
}

echo "=================================================================="
echo " GramSahayak CloudTalk Webhook Test Suite (LD-01)"
echo " Target Gateway: ${BASE_URL}"
echo "=================================================================="

# 0. Gateway health pre-check
HEALTH_RESP=$(curl -sS -w "\n%{http_code}" "${BASE_URL}/api/health" 2>&1 || true)
HEALTH_CODE=$(echo "$HEALTH_RESP" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESP" | sed '$d')
print_result "0. GET /api/health (Gateway Reachable)" "$HEALTH_CODE" "$HEALTH_BODY"

# 1. Incoming Call Webhook -> stage="greeting"
run_post \
  "1. POST /api/cloudtalk/voice/incoming (stage=greeting)" \
  "/api/cloudtalk/voice/incoming" \
  "{\"caller_number\":\"${CALLER_PHONE}\"}"

# 2. DTMF Stage 1 (Language selection: digit 3 -> ta-IN)
run_post \
  "2. POST /api/cloudtalk/voice/dtmf-category (stage=language, digit=3 -> ta-IN)" \
  "/api/cloudtalk/voice/dtmf-category" \
  "{\"caller_number\":\"${CALLER_PHONE}\",\"dtmf_digit\":\"3\",\"stage\":\"language\"}"

# 3. DTMF Stage 2 (Category selection: digit 3 -> health)
run_post \
  "3. POST /api/cloudtalk/voice/dtmf-category (stage=category, digit=3 -> health)" \
  "/api/cloudtalk/voice/dtmf-category" \
  "{\"caller_number\":\"${CALLER_PHONE}\",\"dtmf_digit\":\"3\",\"stage\":\"category\"}"

# 4. Process Speech Webhook (Sample recording URL + fallback text for offline/mock run)
run_post \
  "4. POST /api/cloudtalk/voice/process-speech (sample recording_url)" \
  "/api/cloudtalk/voice/process-speech" \
  "{\"caller_number\":\"${CALLER_PHONE}\",\"recording_url\":\"https://example.com/sample-jsy-ta.wav\",\"text\":\"ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?\"}"

# 5. Incoming SMS Webhook (Keyword: PMKISAN -> <300ms deterministic card summary)
run_post \
  "5. POST /api/cloudtalk/sms/incoming (keyword=PMKISAN)" \
  "/api/cloudtalk/sms/incoming" \
  "{\"from\":\"${SMS_PHONE}\",\"caller_number\":\"${SMS_PHONE}\",\"body\":\"PMKISAN\",\"languageCode\":\"hi-IN\"}"

echo "=================================================================="
echo " Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "=================================================================="

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "NOTE: If routes 1-5 returned HTTP 404, Backend B-07 (/api/cloudtalk/*) is scheduled for H4-10."
  exit 1
fi

exit 0
