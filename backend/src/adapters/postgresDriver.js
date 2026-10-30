const { Pool } = require('pg');
const { PROFILE_COLUMNS, toIso } = require('./rows');

// Postgres / Supabase driver. Tables come from db/schema.postgres.sql (Database role);
// init() refuses to start if they are missing so the adapter falls back to memory.
// Use the Supabase pooler URL (transaction mode, port 6543). pg uses unnamed statements,
// which the transaction pooler supports.

const isLocal = (url) => /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

// SSL is configured here, not in the URL: node-postgres treats sslmode=require as verify-full,
// which rejects Supabase's pooler certificate (signed by Supabase's own CA). Like libpq's
// "require", remote connections are encrypted without CA verification.
const SSL_URL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];

function poolConnection(databaseUrl) {
  let connectionString = databaseUrl;
  try {
    const url = new URL(databaseUrl);
    for (const p of SSL_URL_PARAMS) url.searchParams.delete(p);
    connectionString = url.toString();
  } catch {
    // Not a parseable URL: hand it to pg unchanged.
  }
  return { connectionString, ssl: isLocal(databaseUrl) ? false : { rejectUnauthorized: false } };
}

const normalizeRow = (row) => {
  if (!row) return null;
  const out = { ...row };
  for (const k of ['created_at', 'updated_at', 'ts']) if (k in out) out[k] = toIso(out[k]);
  for (const k of ['land_hectares', 'annual_income', 'age']) if (out[k] != null) out[k] = Number(out[k]);
  return out;
};

function createPostgresDriver({ databaseUrl }) {
  let pool;

  return {
    name: 'postgres',
    async init() {
      if (!databaseUrl) throw new Error('DATABASE_URL is empty');
      pool = new Pool({
        ...poolConnection(databaseUrl),
        max: 5,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        query_timeout: 3000,
      });
      // A pool 'error' must not crash the process; the adapter's circuit breaker handles it.
      pool.on('error', (err) => console.warn('[db:postgres] idle client error:', err.message));
      try {
        await pool.query('SELECT 1');
      } catch (err) {
        throw new Error(`cannot connect (${err.message}); check DATABASE_URL (Supabase pooler, port 6543)`);
      }
      for (const table of ['sessions', 'user_profiles', 'interaction_logs', 'schemes']) {
        try {
          await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        } catch (err) {
          throw new Error(`table "${table}" not usable (${err.message}); apply db/schema.postgres.sql`);
        }
      }
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async getSession(key) {
      const { rows } = await pool.query('SELECT * FROM sessions WHERE session_key = $1', [key]);
      const row = normalizeRow(rows[0]);
      if (row) row.history = Array.isArray(row.history) ? row.history : [];
      return row;
    },
    async putSession(row) {
      await pool.query(
        `INSERT INTO sessions (session_key, phone, history, last_channel, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)
         ON CONFLICT (session_key) DO UPDATE SET
           phone = EXCLUDED.phone, history = EXCLUDED.history,
           last_channel = EXCLUDED.last_channel, updated_at = EXCLUDED.updated_at`,
        [row.session_key, row.phone ?? null, JSON.stringify(row.history || []),
          row.last_channel ?? null, row.created_at, row.updated_at],
      );
    },
    async getProfile(key) {
      const { rows } = await pool.query('SELECT * FROM user_profiles WHERE session_key = $1', [key]);
      return normalizeRow(rows[0]);
    },
    async putProfile(row) {
      const placeholders = PROFILE_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
      const updates = PROFILE_COLUMNS.filter((c) => c !== 'session_key')
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');
      await pool.query(
        `INSERT INTO user_profiles (${PROFILE_COLUMNS.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (session_key) DO UPDATE SET ${updates}`,
        PROFILE_COLUMNS.map((c) => row[c] ?? null),
      );
    },
    async insertLog(row) {
      const { rows } = await pool.query(
        `INSERT INTO interaction_logs (ts, session_key, phone, channel, event_type, detail, latency_ms, ok)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING id`,
        [row.ts, row.session_key ?? null, row.phone ?? null, row.channel ?? null, row.event_type,
          row.detail == null ? null : JSON.stringify(row.detail), row.latency_ms ?? null, row.ok ?? null],
      );
      return Number(rows[0].id);
    },
    async listLogs({ sessionKey, limit = 50 } = {}) {
      const { rows } = sessionKey
        ? await pool.query('SELECT * FROM interaction_logs WHERE session_key = $1 ORDER BY ts DESC LIMIT $2', [sessionKey, limit])
        : await pool.query('SELECT * FROM interaction_logs ORDER BY ts DESC LIMIT $1', [limit]);
      return rows.map((r) => ({ ...normalizeRow(r), id: Number(r.id) }));
    },
    async deleteSession(key) {
      await pool.query('DELETE FROM sessions WHERE session_key = $1', [key]);
    },
    async close() {
      if (pool) await pool.end();
      pool = null;
    },
  };
}

module.exports = { createPostgresDriver, poolConnection };
