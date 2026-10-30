const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setupTestEnv, startApp } = require('./helpers');

// Reset parity with db/demo_reset.py (DB-05) once demo_personas.json carries `starter_history`.
const env = setupTestEnv();
const { config } = require('../src/config');
const fallback = require('../src/config/demoPersonas.fallback');
const sessionService = require('../src/services/sessionService');

const seedDir = path.join(env.tmpDir, 'seed');
const starter = (lang) => [
  { ts: '2026-10-31T00:00:00.000Z', channel: 'web', speaker: 'user', text: 'q', category: 'schemes', language: lang },
  { ts: '2026-10-31T00:00:02.000Z', channel: 'web', speaker: 'assistant', text: 'a', category: 'schemes', language: lang },
];

let app;
before(async () => {
  fs.cpSync(config.paths.seedDir, seedDir, { recursive: true });
  const personas = fallback.map((p) => ({ ...p, starter_history: starter(p.language) }));
  fs.writeFileSync(path.join(seedDir, 'demo_personas.json'), JSON.stringify(personas));
  config.paths.seedDir = seedDir;
  app = await startApp();
});
after(async () => { await app.close(); env.cleanup(); });

test('startup fills an empty persona history with its starter turns (memory driver parity)', async () => {
  const session = await require('../src/adapters/dbAdapter').getSession('+919829055555');
  assert.equal(session.last_channel, 'web');
  assert.deepEqual(session.history, starter('hi-IN'));
});

test('startup never overwrites a persona history that already has turns', async () => {
  const key = '+919822022222';
  await sessionService.appendTurn(key, { channel: 'sms', speaker: 'user', text: 'KCC' });
  await require('../src/services/seedService').seedDemoUsers({ wipe: false });
  const history = await sessionService.getHistory(key);
  assert.equal(history.length, 3);
  assert.equal(history.at(-1).text, 'KCC');
});

test('reset restores each persona to exactly its starter turns, last_channel web', async () => {
  const key = '+919840033333';
  await sessionService.appendTurn(key, { channel: 'sms', speaker: 'user', text: 'JSY' });
  const { status } = await app.call('POST', '/api/demo/reset');
  assert.equal(status, 200);
  const session = await require('../src/adapters/dbAdapter').getSession(key);
  assert.equal(session.last_channel, 'web');
  assert.deepEqual(session.history, starter('ta-IN'));
  // Running it twice changes nothing.
  await app.call('POST', '/api/demo/reset');
  assert.deepEqual((await require('../src/adapters/dbAdapter').getSession(key)).history, starter('ta-IN'));
});
