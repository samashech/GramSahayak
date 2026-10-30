const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-db-'));
process.env.SQLITE_PATH = path.join(tmpDir, 'test.sqlite');
process.env.DATABASE_URL = '';

const dbAdapter = require('../src/adapters/dbAdapter');
const sessionService = require('../src/services/sessionService');

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

for (const driver of ['memory', 'sqlite']) {
  describe(`dbAdapter with DB_DRIVER=${driver}`, () => {
    before(async () => {
      assert.equal(await dbAdapter.init({ driver }), driver);
    });
    after(() => dbAdapter.close());

    test('health reports the active driver', async () => {
      assert.deepEqual(await dbAdapter.health(), { driver, configured: driver, ok: true });
    });

    test('turns from web, ivr and sms land in one history keyed by phone', async () => {
      const key = sessionService.resolveSessionKey({ phone: '98290 11111' });
      assert.equal(key, '+919829011111');
      await sessionService.appendTurn(key, { channel: 'web', speaker: 'user', text: 'पीएम किसान?', category: 'schemes', language: 'hi-IN' });
      await sessionService.appendTurn(key, { channel: 'ivr', speaker: 'assistant', text: 'उत्तर', language: 'hi-IN' });
      await sessionService.appendTurn(key, { channel: 'sms', speaker: 'user', text: 'PMKISAN' });
      const history = await sessionService.getHistory(key);
      assert.deepEqual(history.map((t) => t.channel), ['web', 'ivr', 'sms']);
      assert.equal(history[0].category, 'schemes');
      const session = await dbAdapter.getSession(key);
      assert.equal(session.last_channel, 'sms');
      assert.equal(session.phone, '+919829011111');
    });

    test('history is trimmed to the last 20 turns', async () => {
      const key = `trim-${driver}-0001`;
      for (let i = 0; i < 25; i++) {
        await sessionService.appendTurn(key, { channel: 'web', speaker: i % 2 ? 'assistant' : 'user', text: `t${i}` });
      }
      const history = await sessionService.getHistory(key);
      assert.equal(history.length, 20);
      assert.equal(history[0].text, 't5');
      const rag = sessionService.toRagHistory(history);
      assert.equal(rag.length, 6);
      assert.deepEqual(rag.at(-1), { role: 'user', content: 't24' });
    });

    test('profile upsert merges partial updates and keeps booleans and numbers', async () => {
      const key = `profile-${driver}-0001`;
      await sessionService.updateProfile(key, { role: 'farmer', language: 'hi-IN', land_hectares: '1.2', bpl: 'yes' });
      const p = await sessionService.updateProfile(key, { annual_income: 90000, social_category: 'obc', pregnant: false });
      assert.equal(p.role, 'farmer');
      assert.equal(p.land_hectares, 1.2);
      assert.equal(p.bpl, true);
      assert.equal(p.pregnant, false);
      assert.equal(p.social_category, 'obc');
      const stored = await sessionService.getProfile(key);
      assert.equal(stored.bpl, true);
      assert.equal(stored.annual_income, 90000);
    });

    test('logCallOrSms stores a log row', async () => {
      const id = await dbAdapter.logCallOrSms({ sessionKey: '+919829011111', channel: 'ivr', eventType: 'dtmf', detail: { digit: '1' }, latencyMs: 12.4 });
      assert.ok(id);
      const [latest] = await dbAdapter.listLogs({ sessionKey: '+919829011111', limit: 1 });
      assert.equal(latest.event_type, 'dtmf');
      assert.deepEqual(latest.detail, { digit: '1' });
      assert.equal(latest.latency_ms, 12);
    });

    test('schemes come from the seed file', async () => {
      assert.equal((await dbAdapter.getAllSchemes()).length, 13);
      assert.deepEqual((await dbAdapter.getAllSchemes('education')).map((s) => s.code), ['NSP', 'PMYASASVI', 'PRAGATI']);
      assert.equal((await dbAdapter.getSchemeByCode('pmkisan')).helpline, '155261');
      assert.equal(await dbAdapter.getSchemeByCode('NOPE'), null);
    });
  });
}

test('postgres without DATABASE_URL falls back to memory instead of crashing', async () => {
  assert.equal(await dbAdapter.init({ driver: 'postgres' }), 'memory');
  assert.deepEqual(await dbAdapter.health(), { driver: 'memory', configured: 'postgres', ok: true });
  await dbAdapter.close();
});

test('sanitizeProfile rejects values outside the contract vocabulary', () => {
  assert.throws(() => sessionService.sanitizeProfile({ role: 'doctor' }), /Invalid role/);
  assert.throws(() => sessionService.sanitizeProfile({ category: 'obc', social_category: 'OBC' }), /Invalid social_category/);
  assert.throws(() => sessionService.sanitizeProfile({ age: -1 }), /age must be/);
  assert.deepEqual(sessionService.sanitizeProfile({ category: 'obc', gender: 'female' }), { gender: 'female' });
});

test('phone normalisation and session key resolution', () => {
  assert.equal(sessionService.normalizePhone('+91 98290-11111'), '+919829011111');
  assert.equal(sessionService.normalizePhone('09829011111'), '+919829011111');
  assert.equal(sessionService.normalizePhone('919829011111'), '+919829011111');
  assert.equal(sessionService.normalizePhone('123'), null);
  assert.equal(sessionService.resolveSessionKey({ sessionId: 'a1b2c3d4-e5f6' }), 'a1b2c3d4-e5f6');
  assert.equal(sessionService.resolveSessionKey({ sessionId: 'bad id!' }), null);
});

test('postgres: SSL params are taken out of the URL and set explicitly (Supabase pooler)', () => {
  const { poolConnection } = require('../src/adapters/postgresDriver');
  const remote = poolConnection('postgresql://u.ref:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&application_name=gs');
  assert.equal(remote.connectionString, 'postgresql://u.ref:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?application_name=gs');
  assert.deepEqual(remote.ssl, { rejectUnauthorized: false });
  assert.equal(poolConnection('postgres://u:p@localhost:5432/gs').ssl, false);
});
