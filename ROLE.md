# GramSahayak Team Roles & Context Index (`ROLE.md`)

> **First rule for every human and AI coding agent:** Read **[`/docs/api-contract.md`](docs/api-contract.md)** before starting any task. Wherever any prompt or local file differs from `/docs/api-contract.md`, **the contract wins**.

---

## Role Directory

| Role | Branch Pattern | Commit Scope | Owned Folder(s) | Agent Context Files |
| :--- | :--- | :---: | :--- | :--- |
| **Database** | `feat/db-<task>` | `db` | `/db` *(+ H0 bootstrap, `/data/seed/demo_personas.json`)* | [`/db/CLAUDE.md`](db/CLAUDE.md) · [`/db/AGENTS.md`](db/AGENTS.md) · [`/db/ROLE.md`](db/ROLE.md) |
| **Backend Lead** | `backend` / `feat/be-<task>` | `be` | `/backend` *(+ `/data/seed/schemes.json` & guides via K-04)* | [`/backend/CLAUDE.md`](backend/CLAUDE.md) |
| **Frontend** | `frontend` / `feat/fe-<task>` | `fe` | `/frontend` | Copy Frontend block from [`/docs/role-context-blocks.md`](docs/role-context-blocks.md) into `/frontend/CLAUDE.md` |
| **RAG Chatbot** | `rag` / `feat/rag-<task>` | `rag` | `/rag` | Copy RAG block from [`/docs/role-context-blocks.md`](docs/role-context-blocks.md) into `/rag/CLAUDE.md` |
| **Team Lead** | `feat/lead-<task>` | `lead` / `docs` | `/docs`, `/scripts` | Copy Team Lead block from [`/docs/role-context-blocks.md`](docs/role-context-blocks.md) into `/docs/CLAUDE.md` |

---

## Critical Hand-Offs (Who Unblocks Whom)

| By Hour | Producer | Consumer | Artifact |
| :---: | :--- | :--- | :--- |
| `H0:30` | **Database (`DB-01`)** | Everyone | Repo, branches (`main`, `dev`), `/docs/api-contract.md`, `.gitignore`, `.env.example` |
| `H1:00` | **Backend (`K-04`)** | DB, RAG, Lead | `/data/seed/schemes.json` (13 cards) + `agri.md`, `health.md`, `education.md` |
| `H1:00` | **Database (`DB-02`)** | Backend (`B-02`) | `db/schema.postgres.sql`, `db/schema.sqlite.sql`, `db/init_sqlite.py` |
| `H1:30` | **Frontend (`FE-02`)** | Lead, Backend | Typed API client & contract-faithful mocks |
| `H2:00` | **Database (`DB-05`)** | Backend (`B-03`) | `/data/seed/demo_personas.json` (5 presets incl. `panchayat-hi`) |
| `H2:00` | **RAG (`RAG-01`)** | Backend (`B-06`) | `GET :8000/health` live |
| `H5:00` | **Database (`DB-04`)** | Backend | `DATABASE_URL` (Supabase pooler `:6543`) + SQLite fallback verified |
| `H6:00` | **RAG (`RAG-03`)** | Backend, Lead | `POST /rag/query` passing golden queries `G1–G5, G7` |
| `H8:00` | **Backend (`B-07`)** | Lead (`LD-01`) | CloudTalk webhooks reachable via HTTPS tunnel |
| `H10:00` | **Backend (`B-09`)** | Frontend (`FE-08`) | `/docs/endpoint-map.md` with verified live shapes |
| `H10:00` | **Lead (`LD-02`)** | Everyone | Human fact-checked corrections PR on `/data/seed` |
| `H21:00` | **Backend (`B-11`)** | Frontend (`FE-10`) | Public Node URL for `NEXT_PUBLIC_API_URL` |
