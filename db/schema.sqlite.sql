-- =============================================================================
-- GramSahayak (ग्राम सहायक) — SQLite Schema (DB-02)
-- Source of Truth: /docs/api-contract.md (Sections 3 & 5)
-- Target: Local SQLite file (default: data/gram_sahayak.sqlite)
-- JSON stored as valid JSON TEXT; booleans as INTEGER 0/1; timestamps as ISO-8601 TEXT.
-- Idempotent: safe to run multiple times without error.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_key  TEXT PRIMARY KEY CHECK (length(trim(session_key)) > 0),
    phone        TEXT,
    history      TEXT NOT NULL DEFAULT '[]'
                      CHECK (json_valid(history) AND json_type(history) = 'array'),
    last_channel TEXT CHECK (last_channel IS NULL OR last_channel IN ('web', 'ivr', 'sms')),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    session_key     TEXT    PRIMARY KEY
                            REFERENCES sessions(session_key) ON DELETE CASCADE,
    phone           TEXT,
    role            TEXT    CHECK (role IS NULL OR role IN (
                                'farmer', 'asha', 'panchayat', 'student'
                            )),
    language        TEXT    CHECK (language IS NULL OR language IN (
                                'hi-IN', 'mr-IN', 'ta-IN', 'en-IN',
                                'te-IN', 'bn-IN', 'gu-IN', 'kn-IN',
                                'ml-IN', 'pa-IN', 'od-IN'
                            )),
    occupation      TEXT    CHECK (occupation IS NULL OR occupation IN (
                                'farmer', 'agri_labourer', 'daily_wage',
                                'student', 'homemaker', 'other'
                            )),
    land_hectares   REAL    CHECK (land_hectares IS NULL OR (land_hectares >= 0 AND land_hectares <= 1000)),
    bpl             INTEGER CHECK (bpl IS NULL OR bpl IN (0, 1)),
    age             INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
    gender          TEXT    CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
    pregnant        INTEGER CHECK (pregnant IS NULL OR pregnant IN (0, 1)),
    annual_income   INTEGER CHECK (annual_income IS NULL OR (annual_income >= 0 AND annual_income <= 1000000000)),
    social_category TEXT    CHECK (social_category IS NULL OR social_category IN (
                                'general', 'obc', 'sc', 'st'
                            )),
    state           TEXT,
    district        TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. interaction_logs
CREATE TABLE IF NOT EXISTS interaction_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    session_key TEXT,
    phone       TEXT,
    channel     TEXT    CHECK (channel IS NULL OR channel IN ('web', 'ivr', 'sms')),
    event_type  TEXT    NOT NULL CHECK (event_type IN (
                            'call_incoming', 'dtmf', 'stt', 'answer',
                            'sms_in', 'sms_out', 'sms_receipt',
                            'cache_hit', 'fallback', 'error'
                        )),
    detail      TEXT    CHECK (detail IS NULL OR json_valid(detail)),
    latency_ms  INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
    ok          INTEGER DEFAULT 1 CHECK (ok IS NULL OR ok IN (0, 1))
);

-- 4. schemes
CREATE TABLE IF NOT EXISTS schemes (
    code         TEXT PRIMARY KEY CHECK (code IN (
                          'PMKISAN', 'PMFBY', 'KCC', 'SHC',
                          'PMJAY', 'JSY', 'PMMVY',
                          'MGNREGA', 'UJJWALA', 'PMAY',
                          'NSP', 'PMYASASVI', 'PRAGATI'
                      )),
    id           TEXT NOT NULL UNIQUE CHECK (id = code),
    name_en      TEXT NOT NULL,
    name_hi      TEXT NOT NULL,
    name_mr      TEXT NOT NULL,
    name_ta      TEXT NOT NULL,
    category     TEXT NOT NULL CHECK (category IN (
                          'schemes', 'agri', 'health', 'education'
                      )),
    target_role  TEXT NOT NULL CHECK (target_role IN (
                          'farmer', 'asha', 'panchayat', 'student'
                      )),
    benefits     TEXT NOT NULL,
    eligibility  TEXT NOT NULL,
    exclusions   TEXT NOT NULL DEFAULT '',
    documents    TEXT NOT NULL DEFAULT '[]'
                      CHECK (json_valid(documents) AND json_type(documents) = 'array'),
    how_to_apply TEXT NOT NULL,
    helpline     TEXT NOT NULL,
    portal_url   TEXT NOT NULL,
    sms_summary  TEXT NOT NULL
                      CHECK (json_valid(sms_summary) AND json_type(sms_summary) = 'object'),
    rules        TEXT NOT NULL
                      CHECK (json_valid(rules) AND json_type(rules) = 'object'),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes required by DB-02 (names aligned with backend/src/adapters/sqliteDriver.js)
CREATE INDEX IF NOT EXISTS idx_logs_ts          ON interaction_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_session     ON interaction_logs (session_key);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes (category);
CREATE INDEX IF NOT EXISTS idx_profiles_phone   ON user_profiles (phone);
