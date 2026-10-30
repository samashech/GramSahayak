#!/usr/bin/env bash
# GramSahayak RAG service (:8000), RAG-08.
#   bash rag/run.sh --setup   # once: rag/.venv with Python 3.11 + CPU-only torch + requirements
#   bash rag/run.sh           # run uvicorn on 127.0.0.1:8000 (auto-ingests /data/seed when empty)
#   bash rag/run.sh --reset   # rebuild the Chroma index from /data/seed (+ /data/raw), then run
# Reads the root .env (LLM_API_KEY, MOCK_LLM, ...). /health says "ok" only after load + ingest + warm-up.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PORT="${PORT_RAG:-8000}"

setup() {
  if command -v uv >/dev/null 2>&1; then
    uv venv --python 3.11 .venv
    uv pip install --python .venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu
    uv pip install --python .venv/bin/python -r requirements.txt
  else
    python3.11 -m venv .venv
    .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
    .venv/bin/pip install -r requirements.txt
  fi
  echo "rag/.venv ready"
}

case "${1:-}" in
  --setup) setup; exit 0 ;;
  --reset) [[ -x .venv/bin/python ]] || setup; .venv/bin/python ingest.py --reset ;;
  "") [[ -x .venv/bin/python ]] || setup ;;
  *) sed -n '2,6p' "$0"; exit 2 ;;
esac
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
