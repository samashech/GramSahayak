# Database & Data Engineer Role Guide (`ROLE.md`)

- **Owner:** Database & Data Engineer (Ayush)
- **Primary Folder:** `/db` *(plus Hour-0 repo bootstrap, `/data/seed/demo_personas.json`, and `/data/seed/schemes.json` validation)*
- **Branch Pattern:** `feat/db-<task>` (e.g., `feat/db-setup`, PR into `dev`)
- **Commit Prefix:** `type(db): message` (e.g., `feat(db): ...`, `docs(db): ...`, `fix(db): ...`)
- **Single Source of Truth:** [`/docs/api-contract.md`](../docs/api-contract.md) (`contract-v1`)

---

## 1. Mission & Core Rules

You make the shared ground truth reliable across the entire team:
1. Only the **Node Gateway (`:5000`)** connects to the database (`R1`, `R2`). Frontend (`:3000`) and RAG (`:8000`) **never** touch Postgres or SQLite.
2. `/data/seed/*` is the single ground truth (`R7`). Backend (`K-04`) generated `/data/seed/schemes.json` (13 scheme cards); you validate it strictly (`DB-03`) and load it idempotently, never hand-editing scheme facts yourself.
3. Three adapter modes share identical table and column names:
   - `DB_DRIVER=postgres` -> Supabase Transaction Pooler (`port 6543`) via `DATABASE_URL`
   - `DB_DRIVER=sqlite` -> Local file at `SQLITE_PATH` (`data/gram_sahayak.sqlite`)
   - `DB_DRIVER=memory` -> Backend in-memory fallback
4. Every destructive script (`--reset`, `demo_reset.py`, `restore.py`) **must refuse to run** when `APP_ENV=production`.

---

## 2. Database Prompts & 24-Hour Roadmap (`DB-01` to `DB-06`)

| ID | Window | Deliverable | Status | Unblocks |
| :---: | :---: | :--- | :---: | :--- |
| **DB-01** | `H0–H0:30` | Monorepo skeleton, `/docs/api-contract.md` (`contract-v1`), `README.md`, `docs/team-protocol.md`, PR & CCR templates | **DONE** | Everyone |
| **DB-02** | `H0:30–H1` | `db/schema.postgres.sql`, `db/schema.sqlite.sql`, `db/init_sqlite.py`, `db/README.md`, diff vs `docs/db-integration-for-senior.md` | **DONE** | Backend (`B-02`) |
| **DB-03** | `H1–H3` | `db/seed.schema.json`, `db/validate_seed.py`, `db/seed_db.py` (`--reset`, `--dry-run`, `--check`) | **DONE** | Backend, RAG, Lead |
| **DB-04** | `H4–H6` | Supabase project & pooler `:6543` setup, `db/check_connection.py`, Node `pg` test snippet, `docs/db-fallback.md` | Next | Backend (`DATABASE_URL` by H5) |
| **DB-05** | `H1–H4` | `/data/seed/demo_personas.json` (5 presets), JSON Schema validation, `db/demo_reset.py` (`--check`) | **DONE** | Backend (`B-03` by H2), Frontend |
| **DB-06** | `H10–H22` | `db/snapshot.py`, `db/restore.py`, 2-min restore drill, `EXPLAIN` index audit, optional impact views (`v_channel_usage`, `v_language_usage`, `v_top_schemes`), freeze checklist | Queued | Final Demo & Pitch (`H15–H22`) |

---

## 3. Owned Tables (Contract Section 5)

1. **`sessions`**: `(session_key PK, phone, history JSON, last_channel, created_at, updated_at)`
2. **`user_profiles`**: `(session_key PK -> sessions.session_key ON DELETE CASCADE, phone, role, language, occupation, land_hectares, bpl, age, gender, pregnant, annual_income, social_category, state, district, updated_at)`
3. **`interaction_logs`**: `(id PK, ts, session_key, phone, channel, event_type, detail JSON, latency_ms, ok)`
4. **`schemes`**: `(code PK, id, name_en, name_hi, name_mr, name_ta, category, target_role, benefits, eligibility, exclusions, documents JSON, how_to_apply, helpline, portal_url, sms_summary JSON, rules JSON, updated_at)`

---

## 4. Emergency Playbook (`E-GS-05`: Supabase Will Not Connect)

If `db/check_connection.py` fails on venue Wi-Fi:
1. Verify you are using the **Supabase Transaction Pooler host and port `6543`** (direct port `5432` is often blocked on campus/venue networks).
2. Check `sslmode=require`, URL-encoded special characters in the DB password, and that the Supabase project is not paused.
3. **10-Minute Cut Rule:** If not solved within 10 minutes:
   ```bash
   # Switch .env to SQLite immediately:
   # DB_DRIVER=sqlite
   python3 db/init_sqlite.py
   python3 db/seed_db.py
   python3 db/demo_reset.py
   ```
   Notify the Backend Lead to restart `:5000` and log the decision in `docs/decisions.md`.

---

## 5. Definition of Done

A teammate can wipe their local database and restore identical 13-scheme + 5-persona demo data in **under 2 minutes with one command**.
