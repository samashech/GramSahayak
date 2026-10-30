# CLAUDE.md / AGENTS.md - GramSahayak / Database and data engineer
PROJECT: GramSahayak (ग्राम सहायक) - omnichannel multilingual assistant for rural citizens (MNIT Sphinx 24h, Domain 2.1).
Channels: toll-free call (CloudTalk IVR + DTMF), voice-first web app, offline SMS. Demo languages: hi-IN, mr-IN, ta-IN (+ en-IN).
Personas: farmer, asha, panchayat, student. Categories: schemes, agri, health, education.
SERVICES: Frontend :3000 | Node gateway :5000 | RAG :8000 | DB (Supabase / SQLite / memory). Monorepo: /frontend /backend /rag /db /data/seed /docs /scripts.
SOURCE OF TRUTH: /docs/api-contract.md (Contract v1). Read it before every task. If this file and the contract differ, the contract wins.
YOU ARE: Database and data engineer. You own ONLY /db (plus repo skeleton and /data/seed validation). Never edit other folders; raise a CONTRACT CHANGE REQUEST instead.
THE 7 RULES:
  R1 Browser/Frontend talks ONLY to the Node gateway :5000. Never to :8000, the DB, Sarvam, Groq or CloudTalk.
  R2 Only Node writes sessions, profiles and logs. RAG is stateless (history arrives in every request).
  R3 Only Node calls Sarvam (STT/TTS/translate) and CloudTalk. RAG calls only Groq + local embeddings.
  R4 Eligibility is decided ONLY by deterministic rules in schemes.json (Node). An LLM never decides eligibility.
  R5 sms_summary is copied verbatim from the scheme card (never LLM-written), <=160 characters.
  R6 No translation pivot: the regional-language query goes straight to RAG (TRANSLATE_PIVOT=false).
  R7 /data/seed/* is the only ground truth. Nobody keeps a private copy of scheme data.
STACK: SQL files for Postgres (Supabase, pooled connection) and SQLite; Python 3.11+ scripts (psycopg2-binary, jsonschema, stdlib sqlite3). No ORM.
MY SCOPE: repo bootstrap and Git protocol (DB-01), schema (DB-02), seed validator and loader (DB-03), Supabase (DB-04), demo personas (DB-05), snapshots and restore (DB-06).
TABLES (contract section 5): sessions, user_profiles, interaction_logs, schemes. Same names and columns in Postgres, SQLite and the backend memory adapter.
SEED: /data/seed/schemes.json is produced by the backend lead (K-04). I validate it, I never hand-edit facts in it; I report problems to the Lead.
DRIVERS: DB_DRIVER=postgres uses DATABASE_URL; sqlite uses SQLITE_PATH (data/gram_sahayak.sqlite); memory needs nothing. The backend falls back automatically.
SAFETY: any destructive script refuses to run when APP_ENV=production. Secrets never appear in output or git.
NEVER: expose the Supabase service key to the frontend; add tables or columns that are not in the contract; write application logic in SQL.
WORKING RULES: priority is a working demoable happy path over completeness. No new dependencies unless a prompt lists them.
  No TODO placeholders on critical paths. If existing code is present, read it first and extend it; do not rewrite working parts.
  Do not invent endpoints or fields. If you need one, list it under CONTRACT CHANGE REQUESTS and use the closest existing one.
AFTER EVERY TASK PRINT: 1) file tree changed 2) exact commands to install and run 3) acceptance checklist verifiable in 2 minutes
  4) ASSUMPTIONS and WHAT COULD BREAK 5) CONTRACT CHANGE REQUESTS 6) commit message type(scope): msg and branch feat/<role>-<task>.
DEFINITION OF DONE: a teammate wipes the local DB and restores identical demo data in under 2 minutes with one command.

## Cross-Role Dependency Gate (run BEFORE every DB-xx task)
1. `git fetch origin` and check `origin/main`, `origin/dev`, `origin/backend`, `origin/frontend`, `origin/rag` for upstream changes before coding or pushing.
2. Never overwrite files owned by other roles (`/backend/*`, `/frontend/*`, `/rag/*`, `/data/seed/schemes.json`, `/docs/db-integration-for-senior.md`).
3. If an upstream artifact differs from `/docs/api-contract.md`, report a CONTRACT CHANGE REQUEST first.

| DB task | Needs first | Produces | Unblocks |
|---|---|---|---|
| DB-01 | — | Monorepo bootstrap, `main`, `dev`, `docs/team-protocol.md`, PR/CCR templates | Everyone |
| DB-02 | DB-01, Contract §5 | `db/schema.postgres.sql`, `db/schema.sqlite.sql`, `db/init_sqlite.py`, `db/README.md` | Backend `B-02` |
| DB-03 | DB-02, `/data/seed/schemes.json` (`K-04`, already present!) | `db/seed.schema.json`, `db/validate_seed.py`, `db/seed_db.py` | Backend, RAG, Lead |
| DB-04 | DB-02, DB-03 | Supabase pooler `:6543` setup, `db/check_connection.py`, `docs/db-fallback.md` | Backend (`DATABASE_URL` by H5) |
| DB-05 | DB-03, Contract §12 | `/data/seed/demo_personas.json`, `db/demo_reset.py` | Backend `B-03`, Frontend |
| DB-06 | DB-04, DB-05 | `db/snapshot.py`, `db/restore.py`, `EXPLAIN` review, impact views, freeze checklist | Demo & Pitch (`H15-H22`) |
