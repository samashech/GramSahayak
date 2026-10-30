# GramSahayak Database Layer (`/db`)

Single source of truth: **[`/docs/api-contract.md`](../docs/api-contract.md)** (Sections 3, 5, 10, 12).
Backend integration reference: **[`/docs/db-integration-for-senior.md`](../docs/db-integration-for-senior.md)**.

Only the **Node Gateway (`:5000`)** connects to the database (`R1`, `R2`). Neither Frontend (`:3000`) nor RAG (`:8000`) accesses Postgres or SQLite directly.

---

## 1. Quick Commands

```bash
# Initialize / verify local SQLite database (zero pip packages needed; idempotent):
python3 db/init_sqlite.py

# Clean reset of local SQLite database (blocked when APP_ENV=production):
python3 db/init_sqlite.py --reset

# Install Python dependencies for DB-03..DB-06 (validator, loader, Supabase check, snapshots):
python3 -m venv db/.venv && db/.venv/bin/pip install -r db/requirements.txt

# Validate the 13-card scheme corpus (DB-03):
python3 db/validate_seed.py data/seed/schemes.json

# Idempotently load schemes into active DB_DRIVER (sqlite or postgres) and verify parity:
python3 db/seed_db.py
python3 db/seed_db.py --check
python3 db/seed_db.py --dry-run
python3 db/seed_db.py --reset   # blocked when APP_ENV=production
```

---

## 2. Three Adapter Modes (`DB_DRIVER`)

All three modes expose the exact same four logical tables and `snake_case` column names through `backend/src/adapters/dbAdapter.js`:

| `DB_DRIVER` | Configuration | Storage & Characteristics |
| :--- | :--- | :--- |
| **`postgres`** | `DATABASE_URL` (Supabase Transaction Pooler, port `6543`) | Production/cloud persistence. Apply [`db/schema.postgres.sql`](schema.postgres.sql) in the Supabase SQL Editor first. Node checks `SELECT 1 FROM <table> LIMIT 1` on startup and auto-falls back to `memory` if unreachable. |
| **`sqlite`** | `SQLITE_PATH=data/gram_sahayak.sqlite` | Local file persistence (WAL mode + `PRAGMA foreign_keys = ON`). Initialize via `python3 db/init_sqlite.py`. Works completely offline on venue Wi-Fi drops. |
| **`memory`** | *(none required)* | Zero-dependency in-process fallback (`backend/src/adapters/memoryDriver.js`). Always mirrored on writes so mid-demo DB blips never lose active call/chat turns. |

---

## 3. Column Dictionary (Contract Section 5)

### 3.1 `sessions`

Stores cross-channel conversation history (`web`, `ivr`, `sms`) keyed by E.164 phone (when known) or browser `x-session-id` UUID.

| Column | Postgres Type | SQLite Type | Constraints / Nullable | Meaning | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `session_key` | `TEXT` | `TEXT` | `PRIMARY KEY`, non-empty | E.164 phone (`+91...`) if known, else browser UUID | `"+919829011111"` |
| `phone` | `TEXT` | `TEXT` | Nullable | Normalized E.164 phone number | `"+919829011111"` |
| `history` | `JSONB` | `TEXT` (JSON) | `NOT NULL`, JSON array | Last 20 `Turn` objects (`{ts, channel, speaker, text, category, language}`) | `[{"ts":"2026-10-30T17:00:00.000Z","channel":"web","speaker":"user","text":"पीएम किसान?","category":"schemes","language":"hi-IN"}]` |
| `last_channel` | `TEXT` | `TEXT` | Nullable, `IN ('web','ivr','sms')` | Most recent channel used on this session | `"ivr"` |
| `created_at` | `TIMESTAMPTZ` | `TEXT` (ISO) | `NOT NULL`, default now | Session creation timestamp (UTC ISO-8601) | `"2026-10-30T17:00:00.000Z"` |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` (ISO) | `NOT NULL`, default now | Last turn/update timestamp (UTC ISO-8601) | `"2026-10-30T17:02:15.000Z"` |

---

### 3.2 `user_profiles`

Citizen family/persona attributes used for personalization and deterministic eligibility checks. Partial profiles are valid (`NULL` allowed on all profile attributes).

| Column | Postgres Type | SQLite Type | Constraints / Nullable | Meaning | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `session_key` | `TEXT` | `TEXT` | `PK`, `FK -> sessions(session_key) ON DELETE CASCADE` | Owning session key (Node ensures `sessions` row first) | `"+919829011111"` |
| `phone` | `TEXT` | `TEXT` | Nullable | Citizen E.164 phone number | `"+919829011111"` |
| `role` | `TEXT` | `TEXT` | Nullable, `IN ('farmer','asha','panchayat','student')` | Active citizen/operator persona | `"farmer"` |
| `language` | `TEXT` | `TEXT` | Nullable, 11 contract BCP-47 codes | Preferred language (`hi-IN`, `mr-IN`, `ta-IN`, `en-IN`, etc.) | `"hi-IN"` |
| `occupation` | `TEXT` | `TEXT` | Nullable, `IN ('farmer','agri_labourer','daily_wage','student','homemaker','other')` | Primary occupation | `"farmer"` |
| `land_hectares` | `DOUBLE PRECISION` | `REAL` | Nullable, `0..1000` | Agricultural landholding in hectares | `1.2` |
| `bpl` | `BOOLEAN` | `INTEGER` | Nullable (`0`/`1` in SQLite) | Holds a Below Poverty Line (BPL) ration card | `true` / `1` |
| `age` | `INTEGER` | `INTEGER` | Nullable, `0..120` | Citizen age in years | `45` |
| `gender` | `TEXT` | `TEXT` | Nullable, `IN ('male','female','other')` | Citizen gender | `"male"` |
| `pregnant` | `BOOLEAN` | `INTEGER` | Nullable (`0`/`1` in SQLite) | Currently pregnant / lactating indicator | `false` / `0` |
| `annual_income` | `INTEGER` | `INTEGER` | Nullable, `0..1000000000` | Annual household income in INR/year | `90000` |
| `social_category` | `TEXT` | `TEXT` | Nullable, `IN ('general','obc','sc','st')` | Social category (renamed from `category` per Conflict #5) | `"obc"` |
| `state` | `TEXT` | `TEXT` | Nullable | State name | `"Rajasthan"` |
| `district` | `TEXT` | `TEXT` | Nullable | District name | `"Jaipur"` |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` (ISO) | `NOT NULL`, default now | Last profile update timestamp | `"2026-10-30T17:01:00.000Z"` |

*Index:* `idx_profiles_phone ON user_profiles (phone)`

---

### 3.3 `interaction_logs`

Structured event log across calls, DTMF digits, STT/RAG answers, SMS receipts, cache hits, fallbacks, and errors.

| Column | Postgres Type | SQLite Type | Constraints / Nullable | Meaning | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `INTEGER AUTOINCREMENT` | `PRIMARY KEY` | Auto-incrementing event ID | `42` |
| `ts` | `TIMESTAMPTZ` | `TEXT` (ISO) | `NOT NULL`, default now | Event timestamp (UTC ISO-8601) | `"2026-10-30T17:02:10.120Z"` |
| `session_key` | `TEXT` | `TEXT` | Nullable | Associated session key if available | `"+919829011111"` |
| `phone` | `TEXT` | `TEXT` | Nullable | Caller/sender E.164 phone if available | `"+919829011111"` |
| `channel` | `TEXT` | `TEXT` | Nullable, `IN ('web','ivr','sms')` | Originating channel (`NULL` allowed for system events) | `"ivr"` |
| `event_type` | `TEXT` | `TEXT` | `NOT NULL`, 10 contract enum values | `call_incoming \| dtmf \| stt \| answer \| sms_in \| sms_out \| sms_receipt \| cache_hit \| fallback \| error` | `"dtmf"` |
| `detail` | `JSONB` | `TEXT` (JSON) | Nullable, valid JSON | Event-specific payload (`digit`, `matchedSchemeId`, error info) | `{"digit":"1","stage":"language"}` |
| `latency_ms` | `INTEGER` | `INTEGER` | Nullable, `>= 0` | Operation duration in milliseconds | `812` |
| `ok` | `BOOLEAN` | `INTEGER` | Nullable, default `TRUE`/`1` | Whether the step succeeded | `true` / `1` |

*Indexes:* `idx_logs_ts ON interaction_logs (ts DESC)`, `idx_logs_session ON interaction_logs (session_key)`

---

### 3.4 `schemes`

Database mirror of `/data/seed/schemes.json` (13 flagship & scholarship scheme cards) populated via `db/seed_db.py` (`DB-03`) for parity verification (`--check`) and analytics. *(Per Rule `R7`, Node reads scheme cards at runtime from `/data/seed/schemes.json`.)*

| Column | Postgres Type | SQLite Type | Constraints / Nullable | Meaning | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `code` | `TEXT` | `TEXT` | `PRIMARY KEY`, 13 contract codes | Canonical uppercase scheme code | `"PMKISAN"` |
| `id` | `TEXT` | `TEXT` | `NOT NULL UNIQUE`, `id = code` | Card identifier matching `code` | `"PMKISAN"` |
| `name_en` | `TEXT` | `TEXT` | `NOT NULL` | Official English title | `"PM-KISAN Samman Nidhi"` |
| `name_hi` | `TEXT` | `TEXT` | `NOT NULL` | Hindi title (Devanagari) | `"प्रधानमंत्री किसान सम्मान निधि"` |
| `name_mr` | `TEXT` | `TEXT` | `NOT NULL` | Marathi title (Devanagari) | `"प्रधानमंत्री किसान सन्मान निधी"` |
| `name_ta` | `TEXT` | `TEXT` | `NOT NULL` | Tamil title (Tamil script) | `"பிரதமர் கிசான் சம்மான் நிதி"` |
| `category` | `TEXT` | `TEXT` | `NOT NULL`, `IN ('schemes','agri','health','education')` | Domain category (IVR digit 1–4) | `"schemes"` |
| `target_role` | `TEXT` | `TEXT` | `NOT NULL`, `IN ('farmer','asha','panchayat','student')` | Primary persona role | `"farmer"` |
| `benefits` | `TEXT` | `TEXT` | `NOT NULL` | Verified benefit summary | `"Rs 6,000 per year..."` |
| `eligibility` | `TEXT` | `TEXT` | `NOT NULL` | Human-readable eligibility rules | `"All landholding farmer families..."` |
| `exclusions` | `TEXT` | `TEXT` | `NOT NULL`, default `''` | Explicit exclusion criteria | `"Institutional landholders..."` |
| `documents` | `JSONB` | `TEXT` (JSON) | `NOT NULL`, JSON string array | Required application documents | `["Aadhaar card","Land record"]` |
| `how_to_apply` | `TEXT` | `TEXT` | `NOT NULL` | Application steps (portal / CSC / official) | `"Register on pmkisan.gov.in..."` |
| `helpline` | `TEXT` | `TEXT` | `NOT NULL` | Verified toll-free / official helpline | `"155261"` |
| `portal_url` | `TEXT` | `TEXT` | `NOT NULL` | Official `https://` government portal | `"https://pmkisan.gov.in"` |
| `sms_summary` | `JSONB` | `TEXT` (JSON) | `NOT NULL`, JSON object | Verbatim `<=160` char SMS per locale (`en-IN`, `hi-IN`, `mr-IN`, `ta-IN`) | `{"hi-IN":"पीएम-किसान: ..."}` |
| `rules` | `JSONB` | `TEXT` (JSON) | `NOT NULL`, JSON object | Deterministic eligibility thresholds (`occupations`, `max_land_hectares`, `bpl_only`, etc.) | `{"occupations":["farmer"],"min_age":18,...}` |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` (ISO) | `NOT NULL`, default now | Last seed upsert timestamp | `"2026-10-30T17:00:00.000Z"` |

*Index:* `idx_schemes_category ON schemes (category)`

---

## 4. Diff Report vs Backend `/docs/db-integration-for-senior.md` (DB-02 Item 6)

Per `DB-02` step 6, we diffed `db/schema.postgres.sql` and `db/schema.sqlite.sql` against the Backend Lead's [`/docs/db-integration-for-senior.md`](../docs/db-integration-for-senior.md) and `backend/src/adapters/{postgresDriver,sqliteDriver,rows,sessionService}.js`:

| Area | Backend (`B-02`) | Database (`DB-02`) | Compatibility Verdict |
| :--- | :--- | :--- | :--- |
| **Table & Column Names** | `sessions` (6 cols), `user_profiles` (15 cols), `interaction_logs` (9 cols), `schemes` (18 cols) | Identical names and column order | **100% Match (0 differences)** |
| **Foreign Key** | `user_profiles.session_key -> sessions.session_key ON DELETE CASCADE`; `upsertUserProfile` calls `ensureSession` first | Identical FK with `ON DELETE CASCADE` | **100% Match** |
| **Nullable Log Columns** | `postgresDriver.insertLog` & `sqliteDriver.insertLog` allow `NULL` on `session_key`, `phone`, `channel`, `detail`, `latency_ms`, `ok` | All 6 columns allow `NULL` in `CHECK` constraints | **100% Match** |
| **`land_hectares` Type** | Docs say `numeric / REAL`; `postgresDriver` normalizes with `Number(row.land_hectares)`; `sessionService` bounds `[0, 1000]` | Postgres uses `DOUBLE PRECISION` (`0..1000`), SQLite uses `REAL` (`0..1000`) | **100% Compatible** (returns native float in `pg` and passes `Number()`) |
| **SQLite Bootstrap vs Schema** | `sqliteDriver.js` runs minimal `CREATE TABLE IF NOT EXISTS` (no `CHECK` constraints, 3 indexes: `idx_logs_ts`, `idx_logs_session`, `idx_profiles_phone`) | `db/schema.sqlite.sql` defines full Contract `CHECK` constraints + the exact same 3 index names + `idx_schemes_category` | **100% Compatible** (running `init_sqlite.py` first applies full constraints & all 4 indexes; Node's `IF NOT EXISTS` is a clean no-op) |

**Contract Change Requests Required:** **None (`0`)**.
