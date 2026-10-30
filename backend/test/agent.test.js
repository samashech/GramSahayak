const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');
const { startStub, ragResponse } = require('./stubs');

const env = setupTestEnv();
const { config } = require('../src/config');
const msg = require('../src/config/messages');
const seedSchemes = require('../src/adapters/seedSchemes');
const sessionService = require('../src/services/sessionService');
const eventBus = require('../src/services/eventBus');

const G1 = 'पीएम किसान योजना के लिए कौन पात्र है?';
const G4 = 'கர்ப்பிணிப் பெண்ணுக்கு ஆபத்தான அறிகுறிகள் என்ன?';
const G5 = 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?';
const S1 = 'सांप ने काट लिया है, अभी क्या करें?';
const S2 = 'कीटकनाशक किती टाकू?';
const S3 = 'क्रिकेट का स्कोर क्या है?';
const ANSWER_KEYS = ['answerText', 'category', 'languageCode', 'latencyMs', 'matchedSchemeId', 'safety', 'smsReceipt', 'source', 'sources'];

let app;
let rag;
let sarvam;
let ragMode = 'up';
const pmkisanSource = { id: 'PMKISAN', title: 'PM-KISAN', category: 'schemes', helpline: '155261', portal: 'https://pmkisan.gov.in' };

before(async () => {
  rag = await startStub(({ url, json }) => {
    if (ragMode === 'down') return { status: 500, json: { detail: 'boom' } };
    if (ragMode === 'slow') return { delayMs: 1500, json: ragResponse({ answer: 'late' }) };
    if (url !== '/rag/query') return { status: 404 };
    if (json.query.includes('किसान')) {
      return { json: ragResponse({ answer: 'सभी भूमिधारक किसान परिवार पात्र हैं। pmkisan.gov.in', matched: 'PMKISAN', sms: 'RAG WROTE THIS', sources: [pmkisanSource] }) };
    }
    if (json.query.includes('ஆபத்தான')) return { json: ragResponse({ answer: 'இரத்தப்போக்கு, வலிப்பு ஆகியவை ஆபத்து அறிகுறிகள்.' }) };
    return { json: ragResponse({ answer: 'model text that must not be used for safety cases' }) };
  });
  sarvam = await startStub(({ url }) => {
    if (url === '/speech-to-text') return { json: { transcript: G1, language_code: 'hi-IN' } };
    if (url === '/text-to-speech') return { json: { audios: ['UklGRg=='] } };
    return { status: 404 };
  });
  app = await startApp();
  config.aiRagUrl = rag.url;
  config.sarvamBaseUrl = sarvam.url;
});
after(async () => { await app.close(); await rag.close(); await sarvam.close(); env.cleanup(); });
beforeEach(() => {
  ragMode = 'up'; config.useMockAi = false; config.ragTimeoutMs = 4000; config.sarvamApiKey = '';
  rag.calls.length = 0; sarvam.calls.length = 0;
});

const chat = (body, headers = {}) => app.call('POST', '/api/chat', { body, headers: { 'x-session-id': 'agent-test-0001', ...headers } });

test('G1 via RAG: contract AnswerData, SMS receipt is the seed card verbatim (R5), not RAG text', async () => {
  const { status, json } = await chat({ queryText: G1, languageCode: 'hi-IN', category: 'schemes', role: 'farmer' });
  assert.equal(status, 200);
  const a = json.data;
  assert.deepEqual(Object.keys(a).sort(), ANSWER_KEYS);
  assert.equal(a.source, 'rag');
  assert.equal(a.matchedSchemeId, 'PMKISAN');
  assert.equal(a.smsReceipt.smsReceiptText, seedSchemes.getByCode('PMKISAN').sms_summary['hi-IN']);
  assert.deepEqual(Object.keys(a.smsReceipt).sort(), ['delivery', 'documents', 'helpline', 'portalUrl', 'smsReceiptText']);
  assert.equal(a.smsReceipt.delivery, 'simulated');
  assert.deepEqual(a.sources, [{ id: 'PMKISAN', title: 'PM-KISAN', category: 'schemes', helpline: '155261', portalUrl: 'https://pmkisan.gov.in' }]);
  assert.deepEqual(a.safety, { flagged: false, helplines: [] });
  // RAG request: only contract keys, regional text untouched (R6)
  const sent = rag.calls[0].json;
  assert.deepEqual(Object.keys(sent).sort(), ['category', 'for_voice', 'history', 'language', 'query', 'role']);
  assert.deepEqual([sent.query, sent.language, sent.for_voice], [G1, 'hi-IN', false]);
});

test('history goes to RAG as {role, content}, last 6 turns, and turns are stored', async () => {
  const headers = { 'x-session-id': 'agent-history-01' };
  for (let i = 0; i < 4; i++) await chat({ queryText: `${G1} ${i}`, languageCode: 'hi-IN', role: 'farmer' }, headers);
  const last = rag.calls.at(-1).json.history;
  assert.equal(last.length, 6);
  assert.deepEqual(Object.keys(last[0]).sort(), ['content', 'role']);
  assert.deepEqual(last.map((h) => h.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  assert.equal((await sessionService.getHistory('agent-history-01')).length, 8);
});

test('S1 snake bite: fixed emergency answer, flagged 108, no card, even though RAG answered', async () => {
  const { json } = await chat({ queryText: S1, languageCode: 'hi-IN', category: 'health', role: 'farmer' });
  assert.equal(json.data.answerText, msg.SAFETY_ANSWERS.emergency['hi-IN']);
  assert.deepEqual(json.data.safety, { flagged: true, helplines: ['108'] });
  assert.equal(json.data.matchedSchemeId, null);
  assert.equal(json.data.smsReceipt, null);
  assert.ok(json.data.answerText.indexOf('108') < 40, '108 first');
});

test('G4 pregnancy danger signs: RAG answer kept, safety flagged 108 + 102', async () => {
  const { json } = await chat({ queryText: G4, languageCode: 'ta-IN', category: 'health', role: 'asha' });
  assert.match(json.data.answerText, /வலிப்பு/);
  assert.deepEqual(json.data.safety, { flagged: true, helplines: ['108', '102'] });
});

test('S2 pesticide dose: fixed refusal with Kisan Call Centre; a normal snake word is not an emergency', async () => {
  const s2 = await chat({ queryText: S2, languageCode: 'mr-IN', category: 'agri', role: 'farmer' });
  assert.equal(s2.json.data.answerText, msg.SAFETY_ANSWERS.doseAgri['mr-IN']);
  assert.deepEqual(s2.json.data.safety, { flagged: true, helplines: ['1800-180-1551'] });
  const scheme = await chat({ queryText: 'सांप के काटने पर मुआवजा योजना क्या है?', languageCode: 'hi-IN', role: 'farmer' });
  assert.equal(scheme.json.data.safety.flagged, false);
});

test('kill test: RAG down -> fallback with the local card match, Tamil receipt, still success', async () => {
  ragMode = 'down';
  const events = [];
  const onEvent = (e) => events.push(e);
  eventBus.bus.on('event', onEvent);
  const { status, json } = await chat({ queryText: G5, languageCode: 'ta-IN', category: 'health', role: 'asha' });
  eventBus.bus.off('event', onEvent);
  assert.equal(status, 200);
  assert.equal(json.data.source, 'fallback');
  assert.equal(json.data.matchedSchemeId, 'JSY');
  assert.equal(json.data.smsReceipt.smsReceiptText, seedSchemes.getByCode('JSY').sms_summary['ta-IN']);
  assert.ok(json.data.answerText.startsWith('ஜனனி சுரக்ஷா:'), json.data.answerText);
  assert.ok(events.some((e) => e.type === 'pipeline' && e.step === 'sms_receipt_dispatched'));
});

test('RAG timeout falls back fast; S3 off-topic with RAG down gets the fixed "no verified info" answer', async () => {
  ragMode = 'slow';
  config.ragTimeoutMs = 200;
  const t0 = Date.now();
  const slow = await chat({ queryText: G5, languageCode: 'ta-IN', role: 'asha' });
  assert.ok(Date.now() - t0 < 1200, 'did not wait for the slow RAG');
  assert.equal(slow.json.data.source, 'fallback');
  ragMode = 'down';
  const s3 = await chat({ queryText: S3, languageCode: 'hi-IN', role: 'farmer' });
  assert.equal(s3.json.data.answerText, msg.NO_VERIFIED_INFO['hi-IN']);
  assert.equal(s3.json.data.matchedSchemeId, null);
});

test('USE_MOCK_AI skips RAG entirely', async () => {
  config.useMockAi = true;
  const { json } = await chat({ queryText: G1, languageCode: 'hi-IN', role: 'farmer' });
  assert.equal(rag.calls.length, 0);
  assert.equal(json.data.source, 'fallback');
  assert.equal(json.data.matchedSchemeId, 'PMKISAN');
});

test('POST /api/chat validation', async () => {
  assert.equal((await chat({ queryText: '  ', languageCode: 'hi-IN' })).status, 400);
  assert.equal((await chat({ queryText: 'x', languageCode: 'xx-IN' })).status, 400);
  assert.equal((await chat({ queryText: 'x', languageCode: 'hi-IN', role: 'judge' })).status, 400);
  assert.equal((await chat({ queryText: 'x'.repeat(2001), languageCode: 'hi-IN' })).status, 400);
});

test('voice-chat with Sarvam: STT -> agent -> TTS, voice answer has no URL', async () => {
  config.sarvamApiKey = 'test-key';
  const form = new FormData();
  form.append('audio', new Blob([Buffer.from('not really audio')], { type: 'audio/webm' }), 'clip.webm');
  form.append('role', 'farmer');
  const { status, json } = await app.call('POST', '/api/voice-chat', { form, headers: { 'x-session-id': 'voice-test-0001' } });
  assert.equal(status, 200);
  const d = json.data;
  assert.deepEqual([d.transcript, d.detectedLanguage, d.audioBase64, d.useBrowserTts], [G1, 'hi-IN', 'UklGRg==', false]);
  assert.ok(!/pmkisan\.gov\.in/.test(d.answerText), 'URL stripped from spoken answer');
  assert.equal(d.smsReceipt.smsReceiptText, seedSchemes.getByCode('PMKISAN').sms_summary['hi-IN']);
  const stt = sarvam.calls.find((c) => c.url === '/speech-to-text');
  assert.equal(stt.headers['api-subscription-key'], 'test-key');
  assert.match(stt.raw.toString('latin1'), /saarika:v2\.5/);
  const tts = sarvam.calls.find((c) => c.url === '/text-to-speech').json;
  assert.deepEqual([tts.model, tts.speech_sample_rate, tts.target_language_code], ['bulbul:v2', 22050, 'hi-IN']);
  assert.equal(rag.calls[0].json.for_voice, true);
});

test('voice-chat without Sarvam uses transcriptHint and browser TTS; with neither it is ERR_STT_FAILED', async () => {
  const form = new FormData();
  form.append('audio', new Blob([Buffer.from('x')], { type: 'audio/webm' }), 'clip.webm');
  form.append('transcriptHint', G5);
  form.append('role', 'asha');
  const ok = await app.call('POST', '/api/voice-chat', { form, headers: { 'x-demo-user': 'asha-ta' } });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.json.data.detectedLanguage, ok.json.data.audioBase64, ok.json.data.useBrowserTts], ['ta-IN', null, true]);
  const bare = new FormData();
  bare.append('audio', new Blob([Buffer.from('x')], { type: 'audio/webm' }), 'clip.webm');
  const fail = await app.call('POST', '/api/voice-chat', { form: bare });
  assert.equal(fail.status, 422);
  assert.equal(fail.json.error.code, 'ERR_STT_FAILED');
});
