const { config } = require('../config');
const { createMemoryDriver } = require('./memoryDriver');
const { createSqliteDriver } = require('./sqliteDriver');
const { createPostgresDriver } = require('./postgresDriver');
const seedSchemes = require('./seedSchemes');

// Plug-and-play repository over postgres | sqlite | memory (DB_DRIVER).
// Zero-crash rule: if the configured driver fails at start, or any call fails at runtime,
// the adapter serves from memory and retries the real driver after RETRY_MS.
// Writes always go to memory too, so a mid-demo DB drop keeps recent sessions.

const RETRY_MS = 30_000;

const memory = createMemoryDriver();
let primary = null; // the configured non-memory driver, if it started
let retryAt = 0;
let configuredDriver = config.db.driver;

function createDriver(name) {
  if (name === 'postgres') return createPostgresDriver({ databaseUrl: config.db.databaseUrl });
  if (name === 'sqlite') return createSqliteDriver({ sqlitePath: config.db.sqlitePath, schemaPath: config.db.sqliteSchemaPath });
  return null;
}

async function init({ driver = config.db.driver } = {}) {
  configuredDriver = driver;
  seedSchemes.load();
  primary = null;
  retryAt = 0;
  const candidate = createDriver(driver);
  if (!candidate) return activeDriver();
  try {
    await candidate.init();
    primary = candidate;
  } catch (err) {
    console.warn(`[db] ${driver} unavailable, using memory: ${err.message}`);
    await candidate.close().catch(() => {});
  }
  return activeDriver();
}

const primaryUsable = () => primary && Date.now() >= retryAt;

function activeDriver() {
  return primaryUsable() ? primary.name : 'memory';
}

function tripBreaker(op, err) {
  retryAt = Date.now() + RETRY_MS;
  console.warn(`[db] ${primary.name}.${op} failed, memory for ${RETRY_MS / 1000}s: ${err.message}`);
}

async function read(op, ...args) {
  if (primaryUsable()) {
    try {
      return await primary[op](...args);
    } catch (err) {
      tripBreaker(op, err);
    }
  }
  return memory[op](...args);
}

async function write(op, ...args) {
  const result = await memory[op](...args);
  if (primaryUsable()) {
    try {
      return await primary[op](...args);
    } catch (err) {
      tripBreaker(op, err);
    }
  }
  return result;
}

const now = () => new Date().toISOString();

// ---- Sessions (history = Turn[], last config.historyLimit) ----

async function getSession(sessionKey) {
  return read('getSession', sessionKey);
}

async function ensureSession(sessionKey, { phone = null, channel = null } = {}) {
  const existing = await getSession(sessionKey);
  if (existing) {
    if (phone && !existing.phone) {
      existing.phone = phone;
      existing.updated_at = now();
      await write('putSession', existing);
    }
    return existing;
  }
  const ts = now();
  const row = { session_key: sessionKey, phone, history: [], last_channel: channel, created_at: ts, updated_at: ts };
  await write('putSession', row);
  return row;
}

async function saveSessionTurn(sessionKey, turn, { phone = null } = {}) {
  const session = await ensureSession(sessionKey, { phone, channel: turn.channel });
  session.history = [...(session.history || []), turn].slice(-config.historyLimit);
  session.last_channel = turn.channel || session.last_channel;
  if (phone && !session.phone) session.phone = phone;
  session.updated_at = now();
  await write('putSession', session);
  return session;
}

// ---- Profiles ----

async function getUserProfile(sessionKey) {
  return read('getProfile', sessionKey);
}

async function upsertUserProfile(sessionKey, fields, { phone = null } = {}) {
  await ensureSession(sessionKey, { phone }); // FK: user_profiles.session_key -> sessions
  const existing = (await getUserProfile(sessionKey)) || {};
  const row = {
    ...existing,
    ...fields,
    session_key: sessionKey,
    phone: fields.phone ?? existing.phone ?? phone ?? null,
    updated_at: now(),
  };
  await write('putProfile', row);
  return row;
}

// ---- Interaction logs ----

async function logCallOrSms({ sessionKey = null, phone = null, channel = null, eventType, detail = null, latencyMs = null, ok = true }) {
  const row = {
    ts: now(), session_key: sessionKey, phone, channel, event_type: eventType,
    detail, latency_ms: latencyMs == null ? null : Math.round(latencyMs), ok,
  };
  try {
    return await write('insertLog', row);
  } catch (err) {
    // Logging must never break a user-facing request.
    console.warn('[db] logCallOrSms failed:', err.message);
    return null;
  }
}

async function listLogs(opts) {
  return read('listLogs', opts);
}

async function deleteSession(sessionKey) {
  return write('deleteSession', sessionKey);
}

// ---- Schemes (seed file is ground truth, R7) ----

async function getAllSchemes(category) {
  return seedSchemes.getAll(category);
}

async function getSchemeByCode(code) {
  return seedSchemes.getByCode(code);
}

// ---- Health ----

async function health() {
  if (primary && !primaryUsable()) {
    // Breaker open: report memory until the retry window passes.
    return { driver: 'memory', configured: configuredDriver, ok: true };
  }
  if (primary) {
    try {
      await primary.ping();
      return { driver: primary.name, configured: configuredDriver, ok: true };
    } catch (err) {
      tripBreaker('ping', err);
      return { driver: 'memory', configured: configuredDriver, ok: true };
    }
  }
  return { driver: 'memory', configured: configuredDriver, ok: true };
}

async function close() {
  if (primary) await primary.close().catch(() => {});
  primary = null;
}

module.exports = {
  init,
  close,
  health,
  activeDriver,
  getSession,
  ensureSession,
  saveSessionTurn,
  getUserProfile,
  upsertUserProfile,
  logCallOrSms,
  listLogs,
  deleteSession,
  getAllSchemes,
  getSchemeByCode,
};
