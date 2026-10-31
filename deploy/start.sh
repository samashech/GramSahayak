#!/usr/bin/env bash
# Container entrypoint: RAG on 127.0.0.1:8000 (never public), Node gateway on $PORT.
# If either process exits, the container exits so the host restarts it.
set -uo pipefail
cd /app/rag && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
cd /app/backend && node src/server.js &
wait -n
echo "[start] a service exited; stopping the container" >&2
exit 1
