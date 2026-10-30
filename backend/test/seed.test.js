const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setupTestEnv, startApp } = require('./helpers');

const env = setupTestEnv();
const { config } = require('../src/config');
const seedService = require('../src/services/seedService');
const sessionService = require('../src/services/sessionService');

let app;
const rawCreated = [];
before(async () => { app = await startApp(); });
after(async () => {
  await app.close();
  for (const f of rawCreated) fs.rmSync(path.join(config.repoRoot, f), { force: true });
  env.cleanup();
});

test('guides are split into ## / ### sections with category and heading', () => {
  const agri = seedService.getGuideSections('agri');
  assert.ok(agri.length >= 8);
  const rust = agri.find((s) => s.heading === 'Yellow Rust of wheat (Peela Ratua) > What to do');
  assert.ok(rust, 'nested heading path');
  assert.match(rust.text, /1800-180-1551/);
  assert.ok(seedService.getGuideSections('health').some((s) => /Snake bite/.test(s.heading)));
  assert.equal(seedService.getGuideSections('nope').length, seedService.getGuideSections().length);
});

test('5 demo personas are seeded at startup, keyed by phone', async () => {
  assert.deepEqual(seedService.listPersonas().map((p) => p.id),
    ['farmer-hi', 'farmer-mr', 'asha-ta', 'student-hi', 'panchayat-hi']);
  const p = await sessionService.getProfile('+919829055555');
  assert.equal(p.role, 'panchayat');
  assert.equal(p.language, 'hi-IN');
  assert.equal(p.annual_income, 150000);
});

test('POST /api/demo/reset wipes persona history and restores the profile', async () => {
  const key = '+919829011111';
  await sessionService.appendTurn(key, { channel: 'sms', speaker: 'user', text: 'PMKISAN' });
  await sessionService.updateProfile(key, { land_hectares: 9 });
  const { status, json } = await app.call('POST', '/api/demo/reset');
  assert.equal(status, 200);
  assert.equal(json.data.reset, true);
  assert.equal(json.data.users.length, 5);
  assert.deepEqual(await sessionService.getHistory(key), []);
  assert.equal((await sessionService.getProfile(key)).land_hectares, 1.2);
});

test('POST /api/schemes/ingest saves a JSON card to data/raw; ragIngest null while RAG is down', async () => {
  const card = { code: 'TESTCARD', name_en: 'Test Card', category: 'schemes', benefits: 'x', documents: ['Aadhaar'] };
  const { status, json } = await app.call('POST', '/api/schemes/ingest', { body: card });
  assert.equal(status, 201);
  assert.match(json.data.savedPath, /^data\/raw\/TESTCARD-.*\.json$/);
  assert.equal(json.data.ragIngest, null);
  rawCreated.push(json.data.savedPath, json.data.savedPath.replace(/\.json$/, '.md'));
  assert.ok(fs.existsSync(path.join(config.repoRoot, json.data.savedPath)));
});

test('POST /api/schemes/ingest accepts a multipart .md file and rejects bad input', async () => {
  const form = new FormData();
  form.append('category', 'agri');
  form.append('file', new Blob(['# Circular\n## Note\nNew advisory.']), 'circular note.md');
  const ok = await app.call('POST', '/api/schemes/ingest', { form });
  assert.equal(ok.status, 201);
  assert.match(ok.json.data.savedPath, /^data\/raw\/circular_note-.*\.md$/);
  rawCreated.push(ok.json.data.savedPath);

  const badType = new FormData();
  badType.append('file', new Blob(['x']), 'virus.exe');
  assert.equal((await app.call('POST', '/api/schemes/ingest', { form: badType })).json.error.code, 'ERR_VALIDATION');
  assert.equal((await app.call('POST', '/api/schemes/ingest', { body: { code: 'x' } })).status, 400);
  assert.equal((await app.call('POST', '/api/schemes/ingest', { body: { code: 'ABC', name_en: 'A', category: 'sports' } })).status, 400);
});
