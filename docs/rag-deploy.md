# RAG deployment (RAG-08)

**Decision: Option B, laptop + tunnel (DR-05).** RAG (:8000) and Node (:5000) run on the demo laptop; only Node is
exposed through Cloudflare (`npx cloudflared tunnel --url http://localhost:5000`). `AI_RAG_URL` stays
`http://localhost:8000`. The browser never reaches :8000 (R1).

## Why (measured 2026-10-31)

| Measure | Value |
|---|---|
| Resident memory of the running RAG process (model + Chroma) | **~913 MB** |
| Cold start with an empty index (model load + ingest 45 vectors + warm-up) | ~6.6 s |
| Cold start with an existing index | ~4.5 s |
| `/rag/query` p95 in extractive mode (`run_eval.py`, 20 queries) | ~24 ms |
| Groq LLM mode | not used in the demo (DEC-11) |

A 512 MB free hosting tier would run out of memory, so Option A (cloud host) needs at least 1 GB RAM.

## Run

```bash
bash rag/run.sh --setup     # once: rag/.venv (Python 3.11, CPU-only torch via uv; no CUDA download)
bash rag/run.sh             # :8000; /health says "ok" only after model load + ingest + warm-up
bash rag/run.sh --reset     # rebuild the index from /data/seed (+ /data/raw with per-file categories, CCR-06)
bash scripts/start-demo.sh  # or everything at once (RAG + Node + Next.js)
```

`/health` reports `"degraded"` until the index is ready; Node shows `rag.ok=false` meanwhile and answers from
the local card match / golden cache, so nothing breaks during warm-up.

## Kill test (verified)

Stop RAG while Node runs: `/api/chat` keeps answering with `source: "fallback"` (card match) or `"cache"` (golden
cache), `/api/health` shows `rag.ok: false`; restarting RAG brings `rag.ok: true` back. See `scripts/e2e.sh --kill-test`.
