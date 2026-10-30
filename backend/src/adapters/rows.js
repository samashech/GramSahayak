// Column lists for the four contract tables (contract section 5).
// Every driver stores and returns rows with exactly these snake_case keys.

const SESSION_COLUMNS = ['session_key', 'phone', 'history', 'last_channel', 'created_at', 'updated_at'];

const PROFILE_COLUMNS = [
  'session_key', 'phone', 'role', 'language', 'occupation', 'land_hectares', 'bpl', 'age',
  'gender', 'pregnant', 'annual_income', 'social_category', 'state', 'district', 'updated_at',
];

const LOG_COLUMNS = ['ts', 'session_key', 'phone', 'channel', 'event_type', 'detail', 'latency_ms', 'ok'];

const BOOLEAN_PROFILE_COLUMNS = ['bpl', 'pregnant'];
const NUMERIC_PROFILE_COLUMNS = ['land_hectares', 'age', 'annual_income'];

const toIso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);

const pick = (obj, columns) => Object.fromEntries(columns.map((c) => [c, obj[c] ?? null]));

module.exports = {
  SESSION_COLUMNS,
  PROFILE_COLUMNS,
  LOG_COLUMNS,
  BOOLEAN_PROFILE_COLUMNS,
  NUMERIC_PROFILE_COLUMNS,
  toIso,
  pick,
};
