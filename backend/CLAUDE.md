# CLAUDE.md — GramSahayak (ग्राम सहायक) Master Context & Architecture Contract

> Source: Backend Claude Code Pack v3, section 0.1. `/docs/api-contract.md` (Contract v1) is the single source of truth and OVERRIDES this file wherever they differ.

## 1. Project Identity & Problem Statement (MNIT Sphinx Domain 2.1)
- **Project Name**: GramSahayak (ग्राम सहायक) — Omnichannel Multilingual Voice, Web & Offline SMS Assistant for Rural Citizens.
- **Problem**: Government schemes, crop advisories, health guidelines, and scholarships are published in English or formal Hindi, locking out rural citizens speaking regional languages or using low-bandwidth/feature phones.
- **Target Personas (4 Roles)**:
  1. `farmer` (Small & marginal farmers — PM-KISAN, PMFBY, KCC, pest control, soil cards)
  2. `asha` (ASHA & Anganwadi workers — ANC checkups, pregnancy danger signs, JSY, PMMVY, immunization)
  3. `panchayat` (Gram Panchayat & CSC operators — rapid multi-scheme family eligibility screening & document checklists)
  4. `student` (Rural students & parents — NSP, PM-YASASVI, Pragati Scholarship, JNVST)
- **Featured Demo Languages**: Hindi (`hi-IN`), Marathi (`mr-IN`), Tamil (`ta-IN`) [with full backend support for `te-IN`, `bn-IN`, `gu-IN`, `kn-IN`, `ml-IN`, `pa-IN`, `od-IN`, `en-IN`].
- **4 Categories**: `1` -> `schemes` (Govt Schemes), `2` -> `agri` (Crop/Farming), `3` -> `health` (Maternal/Primary Health), `4` -> `education` (Student Scholarships).

## 2. The 7 Loophole Fixes (MANDATORY ARCHITECTURAL RULES)
1. **Single Unified Agent Brain Across All 3 Channels**: Web UI (`/api/chat`, `/api/voice-chat`), CloudTalk Toll-Free IVR (`/api/cloudtalk/*` + `/api/ivr-simulate`), and Offline SMS (`/api/cloudtalk/sms` + `/api/sms-simulate`) all route through our Node.js Gateway (`Port 5000`) sharing the same session/profile state keyed by `phone` / `sessionId`.
2. **Sub-4.5s Voice Latency (No Translation Pivot)**: Never do a redundant translation round-trip before retrieval (`TRANSLATE_PIVOT=false`). Send the regional transcript (`hi-IN`, `mr-IN`, `ta-IN`) directly to the RAG service (`Port 8000`) which uses cross-lingual embeddings (`intfloat/multilingual-e5-small`) + Groq (`llama-3.3-70b-versatile`) with `for_voice=true` (capped at 2–3 spoken sentences).
3. **Cross-Channel Call-to-SMS Handoff**: Every voice response (Web or CloudTalk IVR) MUST automatically attach a verified `sms_summary` card (`<=160 chars` with official portal URL, documents, and helpline number) and trigger/log an SMS receipt so callers never have to memorize URLs or phone numbers.
4. **Hybrid Deterministic Eligibility + RAG Engine**: Never let an LLM guess income/landholding limits. `POST /api/eligibility` runs deterministic JSON rule matching against `data/seed/schemes.json` (`rules` object: occupation, max_land_hectares, bpl, gender, pregnant, age_min/max) for 100% accuracy.
5. **CloudTalk 14-Day Trial + Built-In Browser IVR & SMS Simulators**: Real telephony routes handle CloudTalk Call Flow Designer HTTP webhooks & DTMF (`1-4`), while `/api/ivr-simulate` and `/api/sms-simulate` let the Next.js UI run an interactive on-screen Phone Keypad & SMS Simulator using the exact same backend pipeline if venue cellular signal drops.
6. **Schema-First Self-Contained Cards**: Scheme data in `data/seed/schemes.json` is structured into complete cards (`id`, `name`, `category`, `benefits`, `eligibility`, `exclusions`, `documents`, `how_to_apply`, `helpline`, `sms_summary`, `rules`).
7. **Medical & Pesticide Safety Guardrails**: Enforce emergency disclaimers and official helplines (`108` Ambulance, `102` Janani Express, `104` Health Helpline, `1800-180-1551` Kisan Call Centre) on health/agri queries.

## 3. Team Service Topology & Ports
- **Frontend (`Port 3000`)**: Next.js 14 App Router (4 Interactive Tabs: 1. Voice-First Rural Web App, 2. Toll-Free IVR Call Simulator, 3. Offline SMS Bot Simulator, 4. Scheme Eligibility Checker).
- **Backend Gateway (`Port 5000` — MY ROLE)**: Node.js + Express. Owns all client/CloudTalk endpoints, Sarvam AI STT (`saarika:v2.5`) + TTS (`bulbul:v2` 8kHz telephony & 22.05kHz web) + Translate (`mayura:v1`), Deterministic Eligibility Engine, Fast SMS Schema Parser, `ffmpeg` 16kHz mono WAV normalizer, and the Plug-and-Play DB Adapter (`dbAdapter.js` compatible with Supabase/Postgres or SQLite + JSON seed).
- **AI / RAG & Vector Service (`Port 8000`)**: Python FastAPI (`app/rag.py`, `app/llm.py`, `ingest.py`) running ChromaDB (`intfloat/multilingual-e5-small`) + Groq (`llama-3.3-70b-versatile` / `Sarvam-M`).

## 4. Universal JSON Envelope (Node.js Port 5000 -> Next.js Port 3000)
Every endpoint returns:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-10-31T08:00:00.000Z"
}
```
Error shape: `{"success": false, "data": null, "error": {"code": "ERR_CODE", "message": "Human readable"}, "timestamp": "..."}`

## 5. Contract v1 Overrides
`/docs/api-contract.md` is the single source of truth. Where sections 1-4 above disagree with it, the contract wins. Read it before every task.

### The 7 rules (contract section 2)
- **R1** Browser/Frontend talks ONLY to the Node gateway :5000. Never to :8000, the DB, Sarvam, Groq or CloudTalk.
- **R2** Only Node writes sessions, profiles and logs. RAG is stateless (history arrives in every request).
- **R3** Only Node calls Sarvam (STT/TTS/translate) and CloudTalk. RAG calls only Groq + local embeddings.
- **R4** Eligibility is decided ONLY by deterministic rules in schemes.json (Node). An LLM never decides eligibility.
- **R5** sms_summary is copied verbatim from the scheme card (never LLM-written), <=160 characters.
- **R6** No translation pivot: the regional-language query goes straight to RAG (TRANSLATE_PIVOT=false).
- **R7** /data/seed/* is the only ground truth. Nobody keeps a private copy of scheme data.

### Vocabulary (exact strings)
- `languageCode`: hi-IN | mr-IN | ta-IN (demo) | en-IN ; also te-IN bn-IN gu-IN kn-IN ml-IN pa-IN od-IN
- `category`: schemes | agri | health | education (IVR digit 1 | 2 | 3 | 4)
- `role`: farmer | asha | panchayat | student (a persona; a chat speaker is `speaker`, never `role`)
- `channel`: web | ivr | sms
- `occupation`: farmer | agri_labourer | daily_wage | student | homemaker | other
- `social_category`: general | obc | sc | st
- Naming: entities/DB = snake_case; Node :5000 request/response = camelCase; RAG :8000 = snake_case. Node maps at the boundary (`languageCode` <-> `language`).

### Overrides
- **K-01/K-02**: do NOT regenerate `/docs/api-contract.md`. Generate only `/docs/architecture-blueprint.md` and root `.env.example`.
- **K-04**: 13 scheme cards (10 flagship + NSP, PMYASASVI, PRAGATI). `sms_summary` is an object `{"en-IN","hi-IN","mr-IN","ta-IN"}` (gu-IN optional), each <=160 chars with portal + helpline. Rule keys (replace `age_min/age_max/bpl` in section 2.4): `occupations, max_land_hectares, bpl_only, gender, pregnant_only, min_age, max_age, max_annual_income, social_categories` (null = no restriction).
- **B-02**: tables are exactly `sessions, user_profiles, interaction_logs, schemes` with contract section 5 columns. Profile includes `annual_income` and `social_category`. `session_key` = phone (E.164) if known, else sessionId. History = JSON array of Turn `{ts, channel, speaker, text, category, language}`, last 20.
- **B-03**: demo personas come from `/data/seed/demo_personas.json` (5 presets incl. `panchayat-hi`); create it from contract section 12 if missing.
- **B-05**: `profile.category` is replaced by `social_category`.
- **B-06**: call `POST {AI_RAG_URL}/rag/query` only (never /rag/retrieve), timeout 4000 ms, then fall back (local card match, then demo cache). Map `Turn.speaker` -> RAG history `{role, content}`; send the last 6 turns.
- **B-06/B-07**: response shapes `AnswerData`, `IvrStep`, `SmsReceipt`, `Safety` exactly as contract section 6. Prefer the card `sms_summary` from schemes.json (by `matched_scheme_id` + languageCode) over any text returned by RAG.
- **B-07**: IVR is two-stage. `POST /api/cloudtalk/voice/dtmf-category` accepts `{caller_number, dtmf_digit, stage}`; stage `"language"` (1 hi-IN, 2 mr-IN, 3 ta-IN) or `"category"` (1 schemes, 2 agri, 3 health, 4 education); missing stage = `"category"`. Invalid digit: re-prompt twice, then default hi-IN / schemes. `/api/ivr-simulate` runs the same controller functions and returns `IvrStep` incl. `webhookLog`.
- **B-01**: `FRONTEND_ORIGIN` is a comma-separated list. Config adds `DEMO_MODE` and `DB_DRIVER` (postgres | sqlite | memory). SMS webhook path is `/api/cloudtalk/sms/incoming` (not `/api/cloudtalk/sms`).
- **Env**: one Groq key `LLM_API_KEY` shared by Node and RAG; RAG URL from `AI_RAG_URL` (may be a tunnel in production).

### Dependency gate (run BEFORE every task)
1. `git fetch origin` and check `origin/main` (and `origin/dev`, `origin/<role>` branches) for the artifacts the task depends on (table below).
2. If a dependency is missing: STOP, tell the user which teammate task (DB-xx / RAG-xx / FE-xx / LD-xx) it is waiting on, and offer the documented fallback. Do not silently create another role's artifact.
3. If an artifact exists but differs from what we assumed: list the differences as CONTRACT CHANGE REQUESTS before coding.

| Backend task | Needs first (owner, due) | Fallback if missing |
|---|---|---|
| A-00 | `/docs/api-contract.md` on main (DB-01, H0:30) | — (wait; contract is DB-01's to commit) |
| K-04 | A-00 | — |
| B-01 / B-02 | repo + `.gitignore` (DB-01); schema column names (DB-02) | memory driver; diff later against `db/schema.*.sql` |
| B-03 | K-04, B-02; `/data/seed/demo_personas.json` (DB-05, H2) | build from contract section 12 |
| B-04 | B-03 | — |
| B-05 | K-04 | — |
| B-06 | `GET :8000/health` (RAG-01, H2); `POST /rag/query` passing golden queries (RAG-03, H6) | local card match + demo cache |
| B-07 | B-06; real CloudTalk field names (LD-01, H6-8) | contract section 7 payloads; simulators |
| B-08 / B-09 | B-06, B-07; typed client + mocks (FE-02) to cross-check shapes | — |
| B-10 | golden queries appendix; RAG eval (RAG-06) | — |
| B-11 | `DATABASE_URL` (DB-04, H5); RAG hosting decision (RAG-08); frontend origin (FE-10) | SQLite; RAG on laptop + tunnel |
| any | seed corrections (LD-02, H10) | keep current seed, flag unverified |

Status (2026-10-30): DB-01 done on `main`/`dev` (built on top of the backend commits; nothing to reconcile). DB-02 schema on `feat/db-setup` matches B-02 (0 differences); the sqlite driver applies `db/schema.sqlite.sql` when present. Still waiting: DB-05 `demo_personas.json` (B-03 uses the contract section 12 fallback), RAG-01/RAG-03 for B-06, LD-01 for B-07 field names.

### Scope
I own only `/backend` (plus K-tasks: `/data/seed`, `/docs/architecture-blueprint.md`, `/docs/db-integration-for-senior.md`, `/docs/endpoint-map.md`, root `.env.example`). Anything else -> CONTRACT CHANGE REQUEST.
