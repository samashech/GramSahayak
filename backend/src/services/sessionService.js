const { config, LANGUAGES, CATEGORIES, ROLES, CHANNELS, OCCUPATIONS, SOCIAL_CATEGORIES, GENDERS } = require('../config');
const { AppError } = require('../utils/response');
const dbAdapter = require('../adapters/dbAdapter');

// Multi-channel session layer (Loophole #1): web, IVR and SMS share one session
// keyed by phone (E.164) when known, else the browser's x-session-id.

function normalizePhone(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  const local = digits.replace(/^0+/, '');
  if (local.length === 10) return `+91${local}`;
  if (local.length === 12 && local.startsWith('91')) return `+${local}`;
  return null;
}

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// session_key is the phone when known, so a phone-shaped key also fills the phone column.
const phoneFor = (sessionKey, phone) =>
  normalizePhone(phone) || (String(sessionKey).startsWith('+') ? sessionKey : null);

function resolveSessionKey({ phone, sessionId } = {}) {
  const e164 = normalizePhone(phone);
  if (e164) return e164;
  if (sessionId && SESSION_ID_RE.test(String(sessionId))) return String(sessionId);
  return null;
}

function requireSessionKey(input) {
  const key = resolveSessionKey(input);
  if (!key) throw new AppError('ERR_VALIDATION', 'A phone number or a valid x-session-id is required');
  return key;
}

// ---- Turns ----

function buildTurn({ channel, speaker, text, category = null, language = null }) {
  if (!CHANNELS.includes(channel)) throw new AppError('ERR_VALIDATION', `Invalid channel: ${channel}`);
  if (speaker !== 'user' && speaker !== 'assistant') throw new AppError('ERR_VALIDATION', `Invalid speaker: ${speaker}`);
  return {
    ts: new Date().toISOString(),
    channel,
    speaker,
    text: String(text ?? ''),
    category: CATEGORIES.includes(category) ? category : null,
    language: LANGUAGES.includes(language) ? language : null,
  };
}

async function appendTurn(sessionKey, turnInput, { phone } = {}) {
  const turn = buildTurn(turnInput);
  await dbAdapter.saveSessionTurn(sessionKey, turn, { phone: phoneFor(sessionKey, phone) });
  return turn;
}

async function getHistory(sessionKey, limit = config.historyLimit) {
  const session = await dbAdapter.getSession(sessionKey);
  return (session?.history || []).slice(-limit);
}

// Contract conflict #13: stored Turn.speaker -> RAG history {role, content}.
function toRagHistory(turns, n = config.ragHistoryTurns) {
  return (turns || [])
    .filter((t) => t && t.text)
    .slice(-n)
    .map((t) => ({ role: t.speaker === 'assistant' ? 'assistant' : 'user', content: t.text }));
}

// ---- Profiles ----

const ENUM_FIELDS = {
  role: ROLES,
  language: LANGUAGES,
  occupation: OCCUPATIONS,
  social_category: SOCIAL_CATEGORIES,
  gender: GENDERS,
};
const NUMBER_FIELDS = { land_hectares: [0, 1000], age: [0, 120], annual_income: [0, 1e9] };
const BOOLEAN_FIELDS = ['bpl', 'pregnant'];
const TEXT_FIELDS = ['state', 'district'];

function toBoolean(value, field) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return Boolean(value);
  const s = String(value).toLowerCase();
  if (['true', 'yes', '1'].includes(s)) return true;
  if (['false', 'no', '0'].includes(s)) return false;
  throw new AppError('ERR_VALIDATION', `${field} must be true or false`);
}

// Validates a partial Profile (snake_case, contract section 5). Unknown keys are ignored;
// null clears a field. Returns only the fields that were present.
function sanitizeProfile(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('ERR_VALIDATION', 'profile must be an object');
  }
  const out = {};
  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    if (!(field in input)) continue;
    const v = input[field];
    if (v === null || v === '') out[field] = null;
    else if (allowed.includes(v)) out[field] = v;
    else throw new AppError('ERR_VALIDATION', `Invalid ${field}: ${v}. Allowed: ${allowed.join(', ')}`);
  }
  for (const [field, [min, max]] of Object.entries(NUMBER_FIELDS)) {
    if (!(field in input)) continue;
    const v = input[field];
    if (v === null || v === '') { out[field] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new AppError('ERR_VALIDATION', `${field} must be a number between ${min} and ${max}`);
    }
    out[field] = field === 'land_hectares' ? n : Math.round(n);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (!(field in input)) continue;
    out[field] = input[field] === null || input[field] === '' ? null : toBoolean(input[field], field);
  }
  for (const field of TEXT_FIELDS) {
    if (!(field in input)) continue;
    out[field] = input[field] == null ? null : String(input[field]).trim().slice(0, 80) || null;
  }
  if ('phone' in input) {
    const phone = normalizePhone(input.phone);
    if (input.phone && !phone) throw new AppError('ERR_VALIDATION', `Invalid phone: ${input.phone}`);
    out.phone = phone;
  }
  return out;
}

async function getProfile(sessionKey) {
  return dbAdapter.getUserProfile(sessionKey);
}

async function updateProfile(sessionKey, partial, { phone } = {}) {
  const fields = sanitizeProfile(partial);
  return dbAdapter.upsertUserProfile(sessionKey, fields, { phone: phoneFor(sessionKey, phone) });
}

async function getProfileWithHistory(sessionKey) {
  const [profile, history] = await Promise.all([getProfile(sessionKey), getHistory(sessionKey)]);
  return { profile, history };
}

module.exports = {
  normalizePhone,
  resolveSessionKey,
  requireSessionKey,
  buildTurn,
  appendTurn,
  getHistory,
  toRagHistory,
  sanitizeProfile,
  getProfile,
  updateProfile,
  getProfileWithHistory,
};
