#!/usr/bin/env bash
# GramSahayak one-command demo launcher.
#   bash scripts/start-demo.sh                # RAG :8000 + Node :5000 + Next.js :3000
#   bash scripts/start-demo.sh --mock-ai      # USE_MOCK_AI=true (no RAG/Groq calls; cache + fallback)
#   bash scripts/start-demo.sh --sqlite       # DB_DRIVER=sqlite (venue Wi-Fi cut rule, DR-04)
#   bash scripts/start-demo.sh --no-frontend  # backend + RAG only
#   bash scripts/start-demo.sh --lan          # also reachable from a phone on the same Wi-Fi (HTTPS,
#                                             # /api proxied through :3000; nothing else exposed)
# Ctrl-C stops every service it started. Logs: .demo-logs/{rag,backend,frontend}.log
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="$ROOT/.demo-logs"
mkdir -p "$LOGS"

WITH_FRONTEND=1
LAN=0
for arg in "$@"; do
  case "$arg" in
    --mock-ai) export USE_MOCK_AI=true ;;
    --sqlite) export DB_DRIVER=sqlite ;;
    --no-frontend) WITH_FRONTEND=0 ;;
    --lan) LAN=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

PIDS=()
cleanup() {
  echo
  echo "[demo] stopping services..."
  for pid in "${PIDS[@]}"; do kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null; done
  wait 2>/dev/null
  echo "[demo] stopped."
}
trap cleanup INT TERM EXIT

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Start a command in its own process group so Ctrl-C stops the whole tree (npm -> node, etc.).
start() {
  local name="$1" dir="$2"; shift 2
  (cd "$dir" && exec setsid "$@") >"$LOGS/$name.log" 2>&1 &
  PIDS+=("$!")
}

wait_for() {
  local name="$1" url="$2" pattern="$3" timeout="$4" i=0
  while (( i < timeout )); do
    if curl -sk --max-time 2 "$url" 2>/dev/null | grep -q "$pattern"; then return 0; fi
    sleep 1; i=$((i + 1))
  done
  echo "[demo] $name did not become healthy in ${timeout}s (see $LOGS/$name.log)"
  return 1
}

echo "=== GramSahayak demo launcher ==="

# 1. Ground truth + SQLite fallback (idempotent; never touches Supabase).
PY="python3"
[[ -x "$ROOT/rag/.venv/bin/python" ]] && PY="$ROOT/rag/.venv/bin/python"
"$PY" "$ROOT/db/validate_seed.py" | tail -1 || { echo "[demo] seed validation failed"; exit 1; }
"$PY" "$ROOT/db/init_sqlite.py" >/dev/null && "$PY" "$ROOT/db/seed_db.py" >/dev/null \
  && echo "[demo] SQLite fallback ready (data/gram_sahayak.sqlite)"

for p in 8000 5000 3000; do
  if port_busy "$p"; then echo "[demo] port $p is already in use; stop that process first."; exit 1; fi
done

# 2. RAG :8000
if [[ -x "$ROOT/rag/.venv/bin/python" ]]; then
  start rag "$ROOT/rag" "$ROOT/rag/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
else
  echo "[demo] rag/.venv missing: run 'bash rag/run.sh --setup' once. Continuing without RAG (fallback mode)."
fi

# 3. Node gateway :5000
[[ -d "$ROOT/backend/node_modules" ]] || (cd "$ROOT/backend" && npm ci --no-audit --no-fund >/dev/null)
start backend "$ROOT/backend" npm run dev

# 4. Next.js :3000
FRONT_URL="http://localhost:3000"
if (( WITH_FRONTEND )); then
  [[ -d "$ROOT/frontend/node_modules" ]] || (cd "$ROOT/frontend" && npm ci --no-audit --no-fund >/dev/null)
  if (( LAN )); then
    # Laptop's Wi-Fi IPv4 (interface of the default route).
    LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')"
    [[ -n "$LAN_IP" ]] || { echo "[demo] could not detect the Wi-Fi IPv4 address"; exit 1; }
    CERT_DIR="$ROOT/frontend/certificates"
    mkdir -p "$CERT_DIR"
    if ! openssl x509 -in "$CERT_DIR/lan-cert.pem" -noout -text 2>/dev/null | grep -q "IP Address:$LAN_IP"; then
      openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=GramSahayak LAN" \
        -addext "subjectAltName=IP:$LAN_IP,IP:127.0.0.1,DNS:localhost" \
        -keyout "$CERT_DIR/lan-key.pem" -out "$CERT_DIR/lan-cert.pem" 2>/dev/null
    fi
    FRONT_URL="https://$LAN_IP:3000"
    # Only this process sees these values; .env files are unchanged. API calls go to the same origin
    # and next.config.ts proxies /api/* to the gateway on 127.0.0.1:5000.
    start frontend "$ROOT/frontend" env NEXT_PUBLIC_API_URL="$FRONT_URL" GS_LAN_HOSTS="$LAN_IP" \
      npm run dev -- --port 3000 --experimental-https \
      --experimental-https-key "$CERT_DIR/lan-key.pem" --experimental-https-cert "$CERT_DIR/lan-cert.pem"
  else
    start frontend "$ROOT/frontend" npm run dev -- --port 3000
  fi
fi

# 5. Health
wait_for backend http://127.0.0.1:5000/api/health '"success":true' 30
[[ -x "$ROOT/rag/.venv/bin/python" ]] && wait_for rag http://127.0.0.1:8000/health '"status":"ok"' 180
(( WITH_FRONTEND )) && wait_for frontend "$FRONT_URL/voice" '<html' 120

echo
echo "=== Health ==="
curl -s http://127.0.0.1:5000/api/health | "$PY" -c '
import json, sys
d = json.load(sys.stdin)["data"]
node, db, rag, sarvam = d["node"], d["db"], d["rag"], d["sarvam"]
print("  Node gateway :5000  OK  (uptime %ss, mockMode=%s)" % (node["uptimeSec"], d["mockMode"]))
print("  Database            %-8s ok=%s" % (db["driver"], db["ok"]))
print("  RAG :8000           ok=%s vectors=%s" % (rag["ok"], rag["vectorCount"]))
print("  Sarvam AI           configured=%s (browser speech fallback if false)" % sarvam["configured"])
' 2>/dev/null || echo "  Node gateway :5000  NOT RESPONDING"
(( WITH_FRONTEND )) && echo "  Frontend :3000      $FRONT_URL  (projector: $FRONT_URL/live)"
if (( LAN )); then
  echo
  echo "=== Phone on the same Wi-Fi ==="
  echo "  Open:  $FRONT_URL/voice"
  echo "  The certificate is self-signed: tap 'Advanced' -> 'Proceed' once (needed for the microphone)."
  echo "  Use the same URL on the laptop too (https://localhost:3000 would be a different origin)."
  echo "  If the phone cannot connect, allow port 3000 for this Wi-Fi subnet only:"
  echo "    sudo ufw allow from ${LAN_IP%.*}.0/24 to any port 3000 proto tcp"
fi
echo
echo "Ctrl-C to stop. Logs in .demo-logs/"
wait
