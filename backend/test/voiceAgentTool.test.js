const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');
const { startStub, ragResponse } = require('./stubs');

const env = setupTestEnv();
const { config } = require('../src/config');
const seedSchemes = require('../src/adapters/seedSchemes');
const sessionService = require('../src/services/sessionService');

// POST /api/agent/answer: the HTTPS tool the Sarvam voice agent calls during a phone call (DEC-19).
const G1 = 'पीएम किसान योजना के लिए कौन पात्र है?';
const SNAKE = 'सांप ने काट लिया है, अभी क्या करें?';

let app;
let rag;
before(async () => {
  rag = await startStub(({ json }) => {
    if (json.query.includes('किसान')) return { json: ragResponse({ answer: 'सभी भूमिधारक किसान परिवार पात्र हैं।', matched: 'PMKISAN' }) };
    return { json: ragResponse({ answer: 'model text' }) };
  });
  app = await startApp();
  config.aiRagUrl = rag.url;
});
after(async () => { await app.close(); await rag.close(); env.cleanup(); });
beforeEach(() => { config.agentToolToken = 'tool-secret'; config.isProduction = false; rag.calls.length = 0; });

const ask = (body, token = 'tool-secret') =>
  app.call('POST', '/api/agent/answer', { body, headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('answers with the verified RAG answer and the seed SMS receipt, keyed by the caller', async () => {
  const { status, json } = await ask({ question: G1, language: 'hindi', caller: '98290 11111', call_id: 'c-1' });
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.answer, json.data.answer);
  assert.equal(json.data.languageCode, 'hi-IN');
  assert.equal(json.data.matchedSchemeId, 'PMKISAN');
  assert.equal(json.data.smsText, seedSchemes.getByCode('PMKISAN').sms_summary['hi-IN']);
  assert.equal(json.data.smsDelivery, 'simulated');
  assert.equal(rag.calls[0].json.for_voice, true);
  const history = await sessionService.getHistory('+919829011111');
  assert.deepEqual(history.slice(-2).map((t) => [t.channel, t.speaker]), [['ivr', 'user'], ['ivr', 'assistant']]);
});

test('emergencies get the fixed safety answer with 108, never model text', async () => {
  const { json } = await ask({ question: SNAKE });
  assert.equal(json.data.safetyFlagged, true);
  assert.ok(json.data.helplines.includes('108'));
  assert.match(json.answer, /108/);
  assert.doesNotMatch(json.answer, /model text/);
});

test('language comes from the parameter, else from the script', async () => {
  assert.equal((await ask({ question: 'PM Kisan kya hai', language: 'mr-IN' })).json.data.languageCode, 'mr-IN');
  assert.equal((await ask({ question: 'પીએમ કિસાન યોજના શું છે?' })).json.data.languageCode, 'gu-IN');
  assert.equal((await ask({ question: 'What is PM Kisan?' })).json.data.languageCode, 'en-IN');
});

test('wrong or missing token is a 404; no token configured is open only outside production', async () => {
  assert.equal((await ask({ question: G1 }, 'wrong')).status, 404);
  assert.equal((await ask({ question: G1 }, null)).status, 404);
  config.agentToolToken = '';
  assert.equal((await ask({ question: G1 }, null)).status, 200);
  config.isProduction = true;
  assert.equal((await ask({ question: G1 }, null)).status, 404);
});

test('an empty question is a validation error', async () => {
  const { status, json } = await ask({ question: '  ' });
  assert.equal(status, 400);
  assert.equal(json.error.code, 'ERR_VALIDATION');
});
