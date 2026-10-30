# DB integration: Node gateway ↔ Database (B-02)

For the Database role (DB-02..DB-06). Table and column names are exactly contract section 5. If your `db/schema.*.sql` differs from this file, **the contract wins**; send a CONTRACT CHANGE REQUEST and I will adapt `backend/src/adapters/*`.

## How the gateway picks a driver

| `DB_DRIVER` | Needs | Implementation |
|---|---|---|
| `postgres` | `DATABASE_URL` (Supabase pooler, transaction mode, port 6543) and the 4 tables already created from `db/schema.postgres.sql` | `backend/src/adapters/postgresDriver.js` (`pg`, SSL on for non-localhost hosts, 3 s connect/query timeout) |
| `sqlite` | `SQLITE_PATH` (default `data/gram_sahayak.sqlite`) | `backend/src/adapters/sqliteDriver.js` (Node's built-in `node:sqlite`; Node ≥ 22.13) |
| `memory` | nothing | `backend/src/adapters/memoryDriver.js` |

**Zero-crash fallback.** If the configured driver fails at startup (missing URL, unreachable host, tables missing), the gateway logs a warning and serves from memory. If a call fails at runtime, it serves from memory for 30 s and then retries the real driver. Writes always go to memory too, so a DB drop mid-demo keeps the recent sessions. `GET /api/health` shows the active driver in `db.driver`.

**Postgres:** the gateway does not create tables; it checks `SELECT 1 FROM <table> LIMIT 1` for all four and falls back to memory if any is missing. **SQLite:** the gateway runs `CREATE TABLE IF NOT EXISTS` with the columns below so it can start before `db/init_sqlite.py` runs. If your schema file creates the tables first, yours are used.

## Tables and how Node uses them

### `sessions`
| column | type (pg / sqlite) | written by Node |
|---|---|---|
| `session_key` PK | text | phone in E.164 (`+919829011111`) if known, else the browser `x-session-id` UUID |
| `phone` | text, nullable | E.164 |
| `history` | jsonb / TEXT (JSON) | array of Turn, last 20, oldest first |
| `last_channel` | text | `web` \| `ivr` \| `sms` |
| `created_at`, `updated_at` | timestamptz / ISO TEXT | |

Turn = `{ "ts": ISO, "channel": "web|ivr|sms", "speaker": "user|assistant", "text": "...", "category": "schemes|agri|health|education"|null, "language": "hi-IN"|... }`

Upsert: `INSERT ... ON CONFLICT (session_key) DO UPDATE SET phone, history, last_channel, updated_at`.

### `user_profiles`
| column | type (pg / sqlite) | notes |
|---|---|---|
| `session_key` PK, FK → `sessions.session_key` ON DELETE CASCADE | text | Node always creates the session row first |
| `phone` | text | E.164 |
| `role` | text | `farmer` \| `asha` \| `panchayat` \| `student` |
| `language` | text | `hi-IN` … (contract vocabulary) |
| `occupation` | text | `farmer` \| `agri_labourer` \| `daily_wage` \| `student` \| `homemaker` \| `other` |
| `land_hectares` | numeric / REAL | |
| `bpl` | boolean / INTEGER 0-1 | |
| `age` | integer | |
| `gender` | text | `male` \| `female` \| `other` |
| `pregnant` | boolean / INTEGER 0-1 | |
| `annual_income` | integer (INR/yr) | |
| `social_category` | text | `general` \| `obc` \| `sc` \| `st` |
| `state`, `district` | text | |
| `updated_at` | timestamptz / ISO TEXT | |

All columns except `session_key` and `updated_at` may be NULL (partial profiles). Node validates every value against the contract vocabulary before writing, so your CHECK constraints will not be hit by the gateway.

Upsert: all 15 columns, `ON CONFLICT (session_key) DO UPDATE`.

### `interaction_logs`
| column | type (pg / sqlite) | notes |
|---|---|---|
| `id` PK | bigserial / INTEGER AUTOINCREMENT | Node never sets it; Postgres insert uses `RETURNING id` |
| `ts` | timestamptz / ISO TEXT | set by Node |
| `session_key`, `phone`, `channel` | text, nullable | |
| `event_type` | text | `call_incoming` \| `dtmf` \| `stt` \| `answer` \| `sms_in` \| `sms_out` \| `sms_receipt` \| `cache_hit` \| `fallback` \| `error` |
| `detail` | jsonb / TEXT (JSON) | free-form object |
| `latency_ms` | integer | |
| `ok` | boolean / INTEGER 0-1 | |

Queries: insert; latest by session (`WHERE session_key = $1 ORDER BY ts DESC LIMIT n`). Please keep the indexes `interaction_logs(ts DESC)` and `interaction_logs(session_key)`.

### `schemes`
Node **reads scheme cards from `/data/seed/schemes.json`** (R7: the seed file is the only ground truth), not from this table. The table is a mirror for your `db/seed_db.py --check` and for analytics. Columns per contract: `code` PK, `id`, `name_en/hi/mr/ta`, `category`, `target_role`, `benefits`, `eligibility`, `exclusions`, `documents` JSON, `how_to_apply`, `helpline`, `portal_url`, `sms_summary` JSON (object keyed `en-IN`/`hi-IN`/`mr-IN`/`ta-IN`), `rules` JSON, `updated_at`.

## Repository interface (`backend/src/adapters/dbAdapter.js`)

```
init({driver})                      -> active driver name
health()                            -> {driver, configured, ok}
getSession(key) / ensureSession(key, {phone, channel})
saveSessionTurn(key, turn, {phone}) -> session (history trimmed to 20)
getUserProfile(key) / upsertUserProfile(key, fields, {phone})
logCallOrSms({sessionKey, phone, channel, eventType, detail, latencyMs, ok})
listLogs({sessionKey, limit}) / deleteSession(key)
getAllSchemes(category) / getSchemeByCode(code)   (seed file)
```

## Test it

```
cd backend && npm test                       # memory + sqlite drivers, 15 tests
DB_DRIVER=postgres DATABASE_URL=... npm start # then: curl localhost:5000/api/health -> db.driver "postgres"
```
