const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');

const env = setupTestEnv();
const sessionService = require('../src/services/sessionService');

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); env.cleanup(); });

const SID = { 'x-session-id': '3f6c2a1e-9b7d-4c1a-8e2f-123456789abc' };

test('GET /api/profile without any session header is a validation error', async () => {
  const { status, json } = await app.call('GET', '/api/profile');
  assert.equal(status, 400);
  assert.equal(json.error.code, 'ERR_VALIDATION');
});

test('new browser session: empty profile and history, then POST merges partial profile', async () => {
  const empty = await app.call('GET', '/api/profile', { headers: SID });
  assert.deepEqual(empty.json.data, { profile: null, history: [] });

  const first = await app.call('POST', '/api/profile', { headers: SID, body: { role: 'student', language: 'ta-IN' } });
  assert.equal(first.status, 200);
  assert.equal(first.json.data.profile.session_key, SID['x-session-id']);

  const second = await app.call('POST', '/api/profile', { headers: SID, body: { profile: { age: '17', bpl: 'no', phone: '9876543210' } } });
  const p = second.json.data.profile;
  assert.deepEqual([p.role, p.language, p.age, p.bpl, p.phone], ['student', 'ta-IN', 17, false, '+919876543210']);
  assert.equal(p.session_key, SID['x-session-id'], 'profile.phone must not change the session key');
});

test('POST /api/profile rejects values outside the contract vocabulary', async () => {
  const { status, json } = await app.call('POST', '/api/profile', { headers: SID, body: { category: 'obc', social_category: 'OBC' } });
  assert.equal(status, 400);
  assert.match(json.error.message, /social_category/);
});

test('x-demo-user resolves to the persona phone and shows web + ivr + sms in one timeline', async () => {
  const key = '+919840033333';
  await sessionService.appendTurn(key, { channel: 'ivr', speaker: 'user', text: 'ஜனனி சுரக்ஷா', language: 'ta-IN' });
  await sessionService.appendTurn(key, { channel: 'sms', speaker: 'assistant', text: 'JSY ...', language: 'ta-IN' });
  const { json } = await app.call('GET', '/api/profile', { headers: { ...SID, 'x-demo-user': 'asha-ta' } });
  assert.equal(json.data.profile.role, 'asha');
  assert.equal(json.data.profile.language, 'ta-IN');
  // Persona starter_history (web turns, CCR-04) comes first when the seed file has it.
  const starter = (require('../src/services/seedService').getPersona('asha-ta').starter_history || []).map(() => 'web');
  assert.deepEqual(json.data.history.map((t) => t.channel), [...starter, 'ivr', 'sms']);
});

test('unknown x-demo-user is rejected', async () => {
  const { status } = await app.call('GET', '/api/profile', { headers: { 'x-demo-user': 'judge-x' } });
  assert.equal(status, 400);
});

test('caller phone in a channel body identifies the session (SMS/IVR simulators)', async () => {
  const { resolveSessionUser } = require('../src/middlewares/sessionContext');
  const fake = { get: () => undefined, body: { fromPhone: '+91 98290 11111' } };
  const u = await resolveSessionUser(fake);
  assert.equal(u.sessionKey, '+919829011111');
  assert.equal(u.role, 'farmer');
});
