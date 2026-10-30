# GramSahayak — Supabase Setup, Connection Proof & 2-Minute Fallback Drill (`DB-04`)

> **Owner:** Database & Data Engineer (`db` — Ayush)
> **Single Source of Truth:** [`/docs/api-contract.md`](../docs/api-contract.md) (Sections 5, 10, 12) & [`/docs/decisions.md`](../docs/decisions.md) (`DR-04`)
> **Mirror Copy:** Kept identically at `/docs/db-fallback.md` and `/db/db-fallback.md`.

---

## 1. Exact Click-Path: Create Supabase Project & Get Transaction Pooler `:6543` URL

> **Why Port `6543` (Transaction Pooler) Is Mandatory:**
> Campus and hackathon venue Wi-Fi networks frequently block direct PostgreSQL port `5432` or IPv6-only direct hosts (`db.<ref>.supabase.co:5432`). Always use the **IPv4-compatible Supabase Supavisor Transaction Pooler on port `6543`**.

### Step-by-Step Click Path (Under 3 Minutes)

1. **Create Project:**
   - Sign in at `https://supabase.com/dashboard` -> click **New project**.
   - **Project Name:** `gram-sahayak-mnit`
   - **Database Password:** Generate a strong alphanumeric password (avoid raw `@`, `#`, `%`, `/` so URL-encoding is never an issue) and save it immediately in the shared password manager note.
   - **Region:** `South Asia (Mumbai) — ap-south-1` (lowest latency from Jaipur/MNIT).
   - Click **Create new project** (waits ~60 seconds to provision).

2. **Apply [`db/schema.postgres.sql`](schema.postgres.sql) (Option A — Web SQL Editor OR Option B — One-Command CLI):**
   - **Option A (Supabase Dashboard SQL Editor):**
     1. In the left sidebar, click **SQL Editor** -> **New query**.
     2. Open [`db/schema.postgres.sql`](schema.postgres.sql), copy the entire file, paste it into the editor, and click **Run** (`Ctrl+Enter`).
     3. Verify it returns `Success. No rows returned` and that **Table Editor** lists all 4 tables: `sessions`, `user_profiles`, `interaction_logs`, `schemes`.
   - **Option B (Automatic from Terminal once `DATABASE_URL` is in `.env`):**
     ```bash
     python3 db/check_connection.py --bootstrap-postgres
     ```
     *(Applies `db/schema.postgres.sql`, seeds all 13 schemes via `db/seed_db.py`, resets all 5 demo personas via `db/demo_reset.py`, and verifies row counts in one command.)*

3. **Copy the Pooled Connection String (`Port 6543`, Transaction Mode):**
   - Click the **Connect** button in the top header bar (or go to **Project Settings (gear icon) -> Database -> Connection string**).
   - Select tab: **URI**.
   - Set **Connection Type / Method:** **Transaction pooler** (host looks like `aws-0-ap-south-1.pooler.supabase.com`, **Port: `6543`**).
   - Copy the URI and replace `[YOUR-PASSWORD]` with the database password and append `?sslmode=require`:
     ```ini
     DB_DRIVER=postgres
     DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```

### Account Ownership & Secret Storage Policy
- **Account Owner:** Database & Data Engineer (**Ayush**) with backup access shared with the **Backend Lead** and **Team Lead (Sameer)**.
- **Where `DATABASE_URL` Is Stored:** Stored **exclusively** in the team's shared password manager / pinned secure note (1Password / Bitwarden secure note `"GramSahayak-Env-Secrets"`) and pasted into each teammate's local untracked root `.env`.
- **Hard Rule:** `DATABASE_URL` and `.env` are **never** committed to Git, printed in logs (`db/check_connection.py` masks passwords as `***`), or exposed to the browser.

---

## 2. Row Level Security (RLS) & Why the Browser Never Receives the Key

For the 24-hour hackathon demo, tables reside in `public` without per-row Supabase Auth policies because **Supabase Auth and `supabase-js` are never used by the client** (`R1`, `R2`):

1. **Strict Backend-Only Boundary (`R1` / `R2`):** The Next.js browser app (`:3000`) talks **only** to the Node Express Gateway (`:5000`) over HTTP using `x-session-id` / `x-demo-user`; only Node connects to Postgres using `DATABASE_URL` from the server-side root `.env`.
2. **Zero Client Key Exposure:** Neither `DATABASE_URL`, the Postgres password, nor any Supabase `service_role` / `anon` key is ever placed in `frontend/.env.local` or prefixed with `NEXT_PUBLIC_`, making it impossible for the browser bundle to receive or leak database credentials.

---

## 3. 10-Line Node `pg` Connectivity Snippet (For Backend Lead)

The Backend Lead can run this exact 10-line one-liner from `/backend` (matches `backend/src/adapters/postgresDriver.js` SSL settings for Supabase pooler `:6543`):

```js
// Run from repo root: node --env-file=.env -e '<paste below>' (or from /backend with NODE_PATH=node_modules)
const { Pool } = require('./backend/node_modules/pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(process.env.DATABASE_URL || '') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 3000,
});
(async () => {
  const t0 = Date.now();
  const { rows } = await pool.query("SELECT 1 AS ok, (SELECT COUNT(*)::int FROM schemes) AS schemes, (SELECT COUNT(*)::int FROM user_profiles) AS profiles");
  console.log('[pg OK]', rows[0], `latency=${Date.now() - t0}ms`);
  await pool.end();
})().catch((e) => { console.error('[pg FAIL]', e.message); process.exit(1); });
```

---

## 4. Verification Command (`db/check_connection.py`)

```bash
# Check both Postgres (if DATABASE_URL is set) and SQLite, printing SELECT 1 latency & 4-table row counts:
python3 db/check_connection.py

# Bootstrap a fresh Supabase database (apply schema + seed 13 schemes + seed 5 personas) and verify parity:
python3 db/check_connection.py --bootstrap-postgres

# Enforce that BOTH Postgres and SQLite pass (exits 1 if DATABASE_URL is missing or unreachable):
python3 db/check_connection.py --require-postgres
```

---

## 5. Under-2-Minute Fallback Drill (`DR-04` / Emergency `E-GS-05`)

If venue Wi-Fi drops, port `6543` is throttled, or Supabase is unreachable for >10 minutes (`DR-04`), switch drivers in **under 2 minutes**.

### (a) Fallback Mode 1: Local File Persistence (`DB_DRIVER=sqlite`) — *Recommended Offline Mode*

Run these 4 commands from the repository root (takes **< 5 seconds**, requires zero internet):

```bash
# 1. Switch DB_DRIVER to sqlite in .env:
sed -i 's/^DB_DRIVER=.*/DB_DRIVER=sqlite/' .env

# 2. Initialize schema, load all 13 verified schemes, and reset all 5 judge personas + starter_history:
python3 db/init_sqlite.py && python3 db/seed_db.py --driver sqlite && python3 db/demo_reset.py --driver sqlite

# 3. Verify 0 differences and SQLite health:
python3 db/check_connection.py
python3 db/seed_db.py --driver sqlite --check && python3 db/demo_reset.py --driver sqlite --check

# 4. Restart the Node gateway (:5000):
cd backend && npm start
```

### (b) Fallback Mode 2: Zero-Setup In-Memory Adapter (`DB_DRIVER=memory`)

Needs **nothing** (no database server, no local file, zero disk I/O):

```bash
# 1. Switch DB_DRIVER to memory in .env:
sed -i 's/^DB_DRIVER=.*/DB_DRIVER=memory/' .env

# 2. Restart Node (:5000) — seedService.init() automatically loads the 13 schemes from
#    /data/seed/schemes.json and seeds the 5 personas + starter_history from /data/seed/demo_personas.json:
cd backend && npm start
```

*(Note: Even when `DB_DRIVER=postgres` or `DB_DRIVER=sqlite`, `backend/src/adapters/dbAdapter.js` automatically mirrors every write into `memoryDriver` and trips a 30-second circuit breaker to `memory` if a query fails mid-demo — zero manual intervention needed during a live judge call.)*

### (c) What the User / Judge Sees in Each Case

**Nothing.**
- Every `/api/*` endpoint (`GET /api/schemes`, `POST /api/eligibility`, `GET/POST /api/profile`, `POST /api/chat`, `POST /api/voice-chat`, `POST /api/ivr-simulate`, `POST /api/sms-simulate`, `POST /api/demo/reset`) returns the **exact same `{success: true, data, error: null, timestamp}` JSON envelope**, the exact same 13 schemes, and the exact same 5 judge personas with their 2-turn `starter_history`.
- No error banner, no blank state, and no latency spike appears on the Frontend (`:3000`). Only `GET /api/health` (`data.db.driver`) reflects `"postgres"`, `"sqlite"`, or `"memory"` for operator visibility.
