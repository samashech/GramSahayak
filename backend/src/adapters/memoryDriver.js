const { SESSION_COLUMNS, PROFILE_COLUMNS, LOG_COLUMNS, pick } = require('./rows');

// memory+json driver: zero setup, always available, also the runtime fallback.
function createMemoryDriver() {
  const sessions = new Map();
  const profiles = new Map();
  let logs = [];
  let nextLogId = 1;

  const clone = (v) => (v == null ? null : structuredClone(v));

  return {
    name: 'memory',
    async init() {},
    async ping() {
      return true;
    },
    async getSession(key) {
      return clone(sessions.get(key));
    },
    async putSession(row) {
      sessions.set(row.session_key, clone(pick(row, SESSION_COLUMNS)));
    },
    async getProfile(key) {
      return clone(profiles.get(key));
    },
    async putProfile(row) {
      profiles.set(row.session_key, clone(pick(row, PROFILE_COLUMNS)));
    },
    async insertLog(row) {
      const id = nextLogId++;
      logs.push({ id, ...clone(pick(row, LOG_COLUMNS)) });
      if (logs.length > 5000) logs = logs.slice(-5000);
      return id;
    },
    async listLogs({ sessionKey, limit = 50 } = {}) {
      const rows = sessionKey ? logs.filter((l) => l.session_key === sessionKey) : logs;
      return clone(rows.slice(-limit).reverse());
    },
    async deleteSession(key) {
      sessions.delete(key);
      profiles.delete(key);
    },
    async close() {},
  };
}

module.exports = { createMemoryDriver };
