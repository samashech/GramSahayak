#!/usr/bin/env bash
# Deploy the backend container (Node gateway + RAG) to Azure App Service (Linux, B1), DEC-19.
# Prereqs: Azure for Students activated, `az login` done, image pushed by .github/workflows/backend-image.yml
# and the ghcr.io package set to public.
#   bash deploy/azure.sh                       # create or update, then print the URL + agent token
#   AZ_APP=my-name AZ_LOCATION=southindia bash deploy/azure.sh
# Secrets are read from backend/.env and .env (first non-empty value wins, like the gateway) and sent
# as App Settings through a temp file: they are never printed or put on a command line.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RG="${AZ_RG:-gramsahayak-rg}"
PLAN="${AZ_PLAN:-gramsahayak-plan}"
APP="${AZ_APP:-gramsahayak-api}"
LOCATION="${AZ_LOCATION:-centralindia}" # Supabase is in Mumbai (ap-south-1)
OWNER="$(git -C "$ROOT" remote get-url origin | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#' | tr '[:upper:]' '[:lower:]')"
IMAGE="${AZ_IMAGE:-ghcr.io/$OWNER/gramsahayak-backend:latest}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"

envval() { # first non-empty value of $1 in backend/.env then .env
  local f v
  for f in "$ROOT/backend/.env" "$ROOT/.env"; do
    [[ -f "$f" ]] || continue
    v="$( (grep -E "^$1=" "$f" || true) | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g')"
    [[ -n "$v" ]] && { printf '%s' "$v"; return 0; }
  done
  return 0 # missing key = empty value, not an error under set -e
}

# The Sarvam voice agent's tool token lives only in the git-ignored root .env.
TOKEN="$(envval AGENT_TOOL_TOKEN)"
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(openssl rand -hex 24)"
  printf '\n# Sarvam voice agent HTTPS tool bearer token (DEC-19)\nAGENT_TOOL_TOKEN=%s\n' "$TOKEN" >> "$ROOT/.env"
fi
[[ -n "$(envval DATABASE_URL)" ]] || { echo "DATABASE_URL missing in backend/.env"; exit 1; }

echo "== Azure: $APP ($LOCATION), image $IMAGE"
az group create -n "$RG" -l "$LOCATION" -o none
az appservice plan show -g "$RG" -n "$PLAN" -o none 2>/dev/null \
  || az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku B1 -o none
if ! az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null; then
  az webapp create -g "$RG" -p "$PLAN" -n "$APP" --container-image-name "$IMAGE" -o none
else
  az webapp config container set -g "$RG" -n "$APP" --container-image-name "$IMAGE" -o none
fi
az webapp update -g "$RG" -n "$APP" --https-only true -o none
az webapp config set -g "$RG" -n "$APP" --always-on true --http20-enabled true -o none

HOST="$(az webapp show -g "$RG" -n "$APP" --query defaultHostName -o tsv)"
SETTINGS="$(mktemp)"
trap 'rm -f "$SETTINGS"' EXIT
SECRET_KEYS=(DATABASE_URL LLM_API_KEY LLM_MODEL LLM_FALLBACK_MODELS LLM_REASONING_EFFORT LLM_CONTEXT_CHUNKS LLM_MAX_TOKENS_VOICE LLM_MAX_TOKENS_TEXT MOCK_LLM SARVAM_API_KEY STT_ORDER SARVAM_TTS_MODEL SARVAM_TTS_SPEAKER)
(
for k in "${SECRET_KEYS[@]}"; do export "GS_$k=$(envval "$k")"; done # exported, not argv: not visible in ps
export GS_AGENT_TOOL_TOKEN="$TOKEN" GS_FRONTEND_ORIGIN="$FRONTEND_ORIGIN"
python3 - "$SETTINGS" <<'PY'
import json, os, sys
fixed = {"WEBSITES_PORT": "8080", "WEBSITES_CONTAINER_START_TIME_LIMIT": "600", "APP_ENV": "production",
         "DEMO_MODE": "true", "DB_DRIVER": "postgres"}
values = {**fixed, **{k[3:]: v for k, v in os.environ.items() if k.startswith("GS_") and v}}
json.dump([{"name": k, "value": v, "slotSetting": False} for k, v in values.items()], open(sys.argv[1], "w"))
PY
)
az webapp config appsettings set -g "$RG" -n "$APP" --settings "@$SETTINGS" -o none
az webapp restart -g "$RG" -n "$APP" -o none

echo "== waiting for https://$HOST/api/health (first start pulls the image, up to ~5 min)"
for _ in $(seq 1 60); do
  if curl -fs --max-time 10 "https://$HOST/api/health" | grep -q '"success":true'; then
    curl -s "https://$HOST/api/health"; echo
    echo
    echo "Backend:        https://$HOST"
    echo "Agent tool URL: https://$HOST/api/agent/answer   (Bearer token = AGENT_TOOL_TOKEN in the root .env)"
    exit 0
  fi
  sleep 10
done
echo "Not healthy yet. Logs: az webapp log tail -g $RG -n $APP"
exit 1
