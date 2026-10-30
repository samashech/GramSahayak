const fs = require('node:fs');
const path = require('node:path');
const { PROFILE_COLUMNS, BOOLEAN_PROFILE_COLUMNS } = require('./rows');

// SQLite driver using Node's built-in node:sqlite (no native build step).
// JSON columns are TEXT, booleans are INTEGER 0/1, timestamps are ISO text.
// The Database role owns db/schema.sqlite.sql (idempotent) and it is applied when present;
// BOOTSTRAP_SQL is only used when that file is missing, so the backend can still start.
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  session_key  TEXT PRIMARY KEY,
  phone        TEXT,
  history      TEXT NOT NULL DEFAULT '[]',
  last_channel TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_profiles (
  session_key     TEXT PRIMARY KEY REFERENCES sessions(session_key) ON DELETE CASCADE,
  phone           TEXT,
  role            TEXT,
  language        TEXT,
  occupation      TEXT,
  land_hectares   REAL,
  bpl             INTEGER,
  age             INTEGER,
  gender          TEXT,
  pregnant        INTEGER,
  annual_income   INTEGER,
  social_category TEXT,
  state           TEXT,
  district        TEXT,
  updated_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interaction_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  session_key TEXT,
  phone       TEXT,
  channel     TEXT,
  event_type  TEXT NOT NULL,
  detail      TEXT,
  latency_ms  INTEGER,
  ok          INTEGER
);
CREATE TABLE IF NOT EXISTS schemes (
  code         TEXT PRIMARY KEY,
  id           TEXT NOT NULL,
  name_en      TEXT, name_hi TEXT, name_mr TEXT, name_ta TEXT,
  category     TEXT, target_role TEXT,
  benefits     TEXT, eligibility TEXT, exclusions TEXT,
  documents    TEXT, how_to_apply TEXT, helpline TEXT, portal_url TEXT,
  sms_summary  TEXT, rules TEXT,
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON interaction_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_session ON interaction_logs(session_key);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON user_profiles(phone);
`;

const toBit = (v) => (v == null ? null : v ? 1 : 0);
const fromBit = (v) => (v == null ? null : Boolean(v));
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

function createSqliteDriver({ sqlitePath, schemaPath }) {
  let db;

  return {
    name: 'sqlite',
    async init() {
      // Required lazily so Node versions without node:sqlite fall back to memory instead of crashing.
      const { DatabaseSync } = require('node:sqlite');
      fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
      db = new DatabaseSync(sqlitePath);
      db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const useOwnerSchema = Boolean(schemaPath) && fs.existsSync(schemaPath);
      db.exec(useOwnerSchema ? fs.readFileSync(schemaPath, 'utf8') : BOOTSTRAP_SQL);
      this.schemaSource = useOwnerSchema ? schemaPath : 'bootstrap';
    },
    async ping() {
      db.prepare('SELECT 1').get();
      return true;
    },
    async getSession(key) {
      const row = db.prepare('SELECT * FROM sessions WHERE session_key = ?').get(key);
      if (!row) return null;
      return { ...row, history: parseJson(row.history, []) };
    },
    async putSession(row) {
      db.prepare(`
        INSERT INTO sessions (session_key, phone, history, last_channel, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_key) DO UPDATE SET
          phone = excluded.phone, history = excluded.history,
          last_channel = excluded.last_channel, updated_at = excluded.updated_at
      `).run(
        row.session_key, row.phone ?? null, JSON.stringify(row.history || []),
        row.last_channel ?? null, row.created_at, row.updated_at,
      );
    },
    async getProfile(key) {
      const row = db.prepare('SELECT * FROM user_profiles WHERE session_key = ?').get(key);
      if (!row) return null;
      const profile = { ...row };
      for (const c of BOOLEAN_PROFILE_COLUMNS) profile[c] = fromBit(row[c]);
      return profile;
    },
    async putProfile(row) {
      const values = PROFILE_COLUMNS.map((c) =>
        BOOLEAN_PROFILE_COLUMNS.includes(c) ? toBit(row[c]) : row[c] ?? null,
      );
      const updates = PROFILE_COLUMNS.filter((c) => c !== 'session_key')
        .map((c) => `${c} = excluded.${c}`)
        .join(', ');
      db.prepare(`
        INSERT INTO user_profiles (${PROFILE_COLUMNS.join(', ')})
        VALUES (${PROFILE_COLUMNS.map(() => '?').join(', ')})
        ON CONFLICT(session_key) DO UPDATE SET ${updates}
      `).run(...values);
    },
    async insertLog(row) {
      const result = db.prepare(`
        INSERT INTO interaction_logs (ts, session_key, phone, channel, event_type, detail, latency_ms, ok)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.ts, row.session_key ?? null, row.phone ?? null, row.channel ?? null, row.event_type,
        row.detail == null ? null : JSON.stringify(row.detail), row.latency_ms ?? null, toBit(row.ok),
      );
      return Number(result.lastInsertRowid);
    },
    async listLogs({ sessionKey, limit = 50 } = {}) {
      const rows = sessionKey
        ? db.prepare('SELECT * FROM interaction_logs WHERE session_key = ? ORDER BY id DESC LIMIT ?').all(sessionKey, limit)
        : db.prepare('SELECT * FROM interaction_logs ORDER BY id DESC LIMIT ?').all(limit);
      return rows.map((r) => ({ ...r, detail: parseJson(r.detail, null), ok: fromBit(r.ok) }));
    },
    async deleteSession(key) {
      db.prepare('DELETE FROM sessions WHERE session_key = ?').run(key);
    },
    async close() {
      if (db) db.close();
      db = null;
    },
  };
}

module.exports = { createSqliteDriver };
