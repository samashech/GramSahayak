# GramSahayak RAG Service (`/rag`)

Stateless multilingual grounded answer engine for **GramSahayak (ग्राम सहायक)** running on port `:8000` (Contract v1, Section 9).

## Stack
- **Python 3.11**
- **FastAPI + Uvicorn** (single worker)
- **LangChain** (`langchain`, `langchain-chroma`, `langchain-huggingface`, `langchain-groq`)
- **ChromaDB** persistent vector store (`intfloat/multilingual-e5-small` embeddings with `"passage: "` / `"query: "` prefixes)
- **Groq** (`llama-3.3-70b-versatile`) with extractive fallback

## Setup & Run (from `/rag`)

```bash
cd rag
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Endpoints (`:8000`)
- `GET /health` -> `{"status":"ok","vector_count":45,"embedding_model":"intfloat/multilingual-e5-small","mode":"llm"|"extractive"}`
- `POST /rag/query` -> Grounded answer with sources, `matched_scheme_id`, verbatim `sms_summary`, `confidence`, `mode`, `latency_ms`
- `POST /rag/ingest` -> Ingests markdown/PDF/JSON file into ChromaDB
- `POST /rag/retrieve` -> Returns top retrieved chunks and `matched_scheme_id`

## Golden Eval Harness (`RAG-06`)

Run the golden evaluation suite (9 golden rows `G1-G5`, `G7`, `S1-S3`, 8 cross-lingual `PMKISAN`/`JSY` checks across `hi-IN`, `mr-IN`, `ta-IN`, `en-IN`, and 20-query sequential `p50`/`p95` latency benchmark):

```bash
python rag/eval/run_eval.py
# Verify loud failure when prompt/output is broken on purpose:
python rag/eval/run_eval.py --simulate-broken-prompt
```
