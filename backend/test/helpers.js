const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolated env for tests: memory DB, no RAG reachable, raw uploads in a temp dir.
function setupTestEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-'));
  Object.assign(process.env, {
    DB_DRIVER: 'memory',
    DATABASE_URL: '',
    DEMO_MODE: 'true',
    AI_RAG_URL: 'http://127.0.0.1:9', // discard port: RAG is "down"
    // Never reach real AI services from tests, whatever .env holds.
    LLM_API_KEY: '',
    SARVAM_API_KEY: '',
    CLOUDTALK_API_KEY_ID: '',
    CLOUDTALK_API_SECRET: '',
    USE_MOCK_AI: 'false',
    SQLITE_PATH: path.join(tmpDir, 'test.sqlite'),
  });
  return { tmpDir, cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }) };
}

// Boots the real Express app on a random port.
async function startApp() {
  const dbAdapter = require('../src/adapters/dbAdapter');
  const seedService = require('../src/services/seedService');
  const { createApp } = require('../src/app');
  await dbAdapter.init({ driver: 'memory' });
  await seedService.init();
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { body, headers = {}, form } = {}) => {
    const init = { method, headers: { ...headers } };
    if (form) init.body = form;
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(base + url, init);
    return { status: res.status, json: await res.json() };
  };
  return { base, call, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { setupTestEnv, startApp };
