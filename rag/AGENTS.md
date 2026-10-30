# CLAUDE.md / AGENTS.md - GramSahayak / RAG and AI engineer
PROJECT: GramSahayak (ग्राम सहायक) - omnichannel multilingual assistant for rural citizens (MNIT Sphinx 24h, Domain 2.1).
Channels: toll-free call (CloudTalk IVR + DTMF), voice-first web app, offline SMS. Demo languages: hi-IN, mr-IN, ta-IN (+ en-IN).
Personas: farmer, asha, panchayat, student. Categories: schemes, agri, health, education.
SERVICES: Frontend :3000 | Node gateway :5000 | RAG :8000 | DB (Supabase / SQLite / memory). Monorepo: /frontend /backend /rag /db /data/seed /docs /scripts.
SOURCE OF TRUTH: /docs/api-contract.md (Contract v1). Read it before every task. If this file and the contract differ, the contract wins.
YOU ARE: RAG and AI engineer. You own ONLY /rag. Never edit other folders; raise a CONTRACT CHANGE REQUEST instead.
THE 7 RULES:
  R1 Browser/Frontend talks ONLY to the Node gateway :5000. Never to :8000, the DB, Sarvam, Groq or CloudTalk.
  R2 Only Node writes sessions, profiles and logs. RAG is stateless (history arrives in every request).
  R3 Only Node calls Sarvam (STT/TTS/translate) and CloudTalk. RAG calls only Groq + local embeddings.
  R4 Eligibility is decided ONLY by deterministic rules in schemes.json (Node). An LLM never decides eligibility.
  R5 sms_summary is copied verbatim from the scheme card (never LLM-written), <=160 characters.
  R6 No translation pivot: the regional-language query goes straight to RAG (TRANSLATE_PIVOT=false).
  R7 /data/seed/* is the only ground truth. Nobody keeps a private copy of scheme data.
STACK: Python 3.11, FastAPI + uvicorn, LangChain (langchain, langchain-chroma, langchain-huggingface, langchain-groq), ChromaDB persistent, sentence-transformers with intfloat/multilingual-e5-small, pypdf. One uvicorn worker.
MY SCOPE: /health, POST /rag/query, POST /rag/ingest (optional POST /rag/retrieve), ingest.py, prompts, guardrails, extractive fallback, eval, run/deploy notes.
CONTRACT (section 9): plain JSON, snake_case. /rag/query request {query, language, category|null, role, for_voice, history[{role,content}]}; response {answer, sources[{id,title,category,helpline,portal}], matched_scheme_id|null, sms_summary|null, confidence, mode, latency_ms}.
EMBEDDINGS: "passage: " prefix when indexing, "query: " prefix when searching. No translation of the query (R6). Category metadata filter when category is given.
GROUNDING: answers only from retrieved context. Never invent amounts, dates, limits, documents or phone numbers. Eligibility decisions are not yours (R4): state the official criteria and point to the Eligibility Checker or the CSC / Panchayat.
SMS: sms_summary is copied verbatim from the matched card in the requested language (en-IN, hi-IN, mr-IN, ta-IN), never generated (R5).
SAFETY: medical = no diagnosis, no medicine doses, danger signs -> go to the nearest health centre now, 108 ambulance, 102 pregnancy ambulance. Agri = no pesticide brand or dose, give IPM steps from the guide and refer to KVK / Kisan Call Centre 1800-180-1551.
BUDGET: /rag/query p95 <= 1500 ms. Groq temperature 0.2. LLM timeout 3.5 s, then extractive fallback.
ENV: LLM_API_KEY, LLM_MODEL, EMBED_MODEL, CHROMA_DIR, RAG_TOP_K=4, RAG_MATCH_THRESHOLD=0.80, MOCK_LLM. Root .env loaded with python-dotenv.
NEVER: implement Sarvam, CloudTalk, sessions, eligibility or SMS parsing; write to the database; expose secrets; return a stack trace to the caller.
WORKING RULES: priority is a working demoable happy path over completeness. No new dependencies unless a prompt lists them.
  No TODO placeholders on critical paths. If existing code is present, read it first and extend it; do not rewrite working parts.
  Do not invent endpoints or fields. If you need one, list it under CONTRACT CHANGE REQUESTS and use the closest existing one.
AFTER EVERY TASK PRINT: 1) file tree changed 2) exact commands to install and run 3) acceptance checklist verifiable in 2 minutes
  4) ASSUMPTIONS and WHAT COULD BREAK 5) CONTRACT CHANGE REQUESTS 6) commit message type(scope): msg and branch feat/<role>-<task>.
DEFINITION OF DONE: python rag/eval/run_eval.py passes G1-G5, G7 and S1-S3 with latency inside budget; the Node gateway shows rag.ok in /api/health.
