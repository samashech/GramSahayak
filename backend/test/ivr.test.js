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
const ivr = require('../src/controllers/cloudtalkController');
const { isFetchableUrl } = require('../src/services/cloudtalkService');

const CALLER = '+919840033333'; // asha-ta
const G5 = 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?';
const STEP_KEYS = ['answer', 'audioBase64', 'promptText', 'session', 'stage', 'useBrowserTts', 'webhookLog'];

let app;
let rag;
let sarvam;
let cloudtalk;
let ragUp = false;
let smsStatus = 200;

before(async () => {
  rag = await startStub(({ json }) => {
    if (!ragUp) return { status: 503 };
    return { json: ragResponse({ answer: `RAG: ${json.query.slice(0, 20)}` }) };
  });
  sarvam = await startStub(({ url }) => (url === '/text-to-speech' ? { json: { audios: ['UklGRg=='] } } : { status: 404 }));
  cloudtalk = await startStub(() => ({ status: smsStatus, json: { status: 'ok' } }));
  app = await startApp();
  config.aiRagUrl = rag.url;
  config.sarvamBaseUrl = sarvam.url;
  config.cloudtalk.baseUrl = cloudtalk.url;
});
after(async () => { await app.close(); await rag.close(); await sarvam.close(); await cloudtalk.close(); env.cleanup(); });
beforeEach(() => {
  ivr._resetCalls();
  ragUp = false; smsStatus = 200;
  config.sarvamApiKey = '';
  Object.assign(config.cloudtalk, { apiKeyId: '', apiSecret: '', webhookSecret: '' });
  rag.calls.length = 0; sarvam.calls.length = 0; cloudtalk.calls.length = 0;
});

const sim = (body) => app.call('POST', '/api/ivr-simulate', { body });
const hook = (path, body, query = '') => app.call('POST', `/api/cloudtalk${path}${query}`, { body });

test('simulator: full call G5 (Tamil, health) follows contract section 7 and returns IvrStep', async () => {
  const g = await sim({ callerPhone: CALLER, stage: 'greeting' });
  assert.equal(g.status, 200);
  assert.deepEqual(Object.keys(g.json.data).sort(), STEP_KEYS);
  assert.equal(g.json.data.stage, 'greeting');
  assert.equal(g.json.data.promptText, msg.IVR.greeting);
  assert.deepEqual(g.json.data.webhookLog.request, { caller_number: CALLER });

  const l = await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '3' });
  assert.equal(l.json.data.stage, 'language');
  assert.equal(l.json.data.promptText, msg.IVR.categoryMenu['ta-IN']);
  assert.deepEqual(l.json.data.session, { languageCode: 'ta-IN', category: null });
  assert.deepEqual(l.json.data.webhookLog.request, { caller_number: CALLER, dtmf_digit: '3', stage: 'language' });

  const c = await sim({ callerPhone: CALLER, stage: 'category', dtmfDigit: '3' });
  assert.deepEqual([c.json.data.stage, c.json.data.promptText], ['category', msg.IVR.speak['ta-IN']]);
  assert.deepEqual(c.json.data.session, { languageCode: 'ta-IN', category: 'health' });

  const s = await sim({ callerPhone: CALLER, stage: 'speech', text: G5 });
  const a = s.json.data.answer;
  assert.equal(s.json.data.stage, 'answer');
  assert.equal(s.json.data.promptText, `${a.answerText} ${msg.IVR.followUp['ta-IN']}`, 'answer + invitation to ask again');
  assert.equal(a.matchedSchemeId, 'JSY');
  assert.equal(a.source, 'fallback', 'RAG is down in this test');
  assert.equal(a.smsReceipt.smsReceiptText, seedSchemes.getByCode('JSY').sms_summary['ta-IN']);
  assert.equal(a.smsReceipt.delivery, 'simulated');

  const bye = await sim({ callerPhone: CALLER, stage: 'goodbye' });
  assert.deepEqual([bye.json.data.stage, bye.json.data.promptText], ['goodbye', msg.IVR.goodbye['ta-IN']]);
  const turns = await sessionService.getHistory(CALLER);
  assert.deepEqual(turns.slice(-2).map((t) => [t.channel, t.speaker]), [['ivr', 'user'], ['ivr', 'assistant']]);
});

test('voice agent: after an answer the caller can ask another question by voice', async () => {
  await sim({ callerPhone: CALLER, stage: 'greeting' });
  await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '1' });
  await sim({ callerPhone: CALLER, stage: 'category', dtmfDigit: '3' });
  const first = await sim({ callerPhone: CALLER, stage: 'speech', text: 'जननी सुरक्षा योजना में कितना पैसा मिलता है?' });
  assert.equal(first.json.data.answer.matchedSchemeId, 'JSY');
  const second = await sim({ callerPhone: CALLER, stage: 'speech', text: 'आयुष्मान कार्ड कैसे बनेगा?' });
  assert.deepEqual([second.json.data.stage, second.json.data.answer.matchedSchemeId], ['answer', 'PMJAY']);
  assert.equal((await sim({ callerPhone: CALLER, stage: 'goodbye' })).json.data.stage, 'goodbye');
});

test('invalid digit: re-prompt the same stage twice, then default hi-IN / schemes', async () => {
  await sessionService.updateProfile(CALLER, { language: 'ta-IN' });
  await sim({ callerPhone: CALLER, stage: 'greeting' });
  for (let i = 0; i < 2; i++) {
    const r = await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '9' });
    assert.equal(r.json.data.stage, 'greeting');
    // Re-prompt: "invalid" in the caller's known language + the multilingual menu again.
    assert.equal(r.json.data.promptText, `${msg.IVR.invalid['ta-IN']} ${msg.IVR.greeting}`);
  }
  const third = await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '9' });
  assert.deepEqual([third.json.data.stage, third.json.data.session.languageCode], ['language', 'hi-IN']);
  assert.equal((await sessionService.getProfile(CALLER)).language, 'ta-IN', 'a fallback default does not overwrite the profile');
  for (let i = 0; i < 2; i++) assert.equal((await sim({ callerPhone: CALLER, stage: 'category', dtmfDigit: '7' })).json.data.stage, 'language');
  const cat = await sim({ callerPhone: CALLER, stage: 'category', dtmfDigit: '0' });
  assert.deepEqual(cat.json.data.session, { languageCode: 'hi-IN', category: 'schemes' });
});

test('silence: re-prompt once, then goodbye', async () => {
  await sim({ callerPhone: CALLER, stage: 'greeting' });
  await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '1' });
  await sim({ callerPhone: CALLER, stage: 'category', dtmfDigit: '1' });
  const first = await sim({ callerPhone: CALLER, stage: 'speech' });
  assert.equal(first.json.data.stage, 'category');
  assert.equal(first.json.data.promptText, `${msg.IVR.silence['hi-IN']} ${msg.IVR.speak['hi-IN']}`);
  const second = await sim({ callerPhone: CALLER, stage: 'speech', text: '  ' });
  assert.equal(second.json.data.stage, 'goodbye');
});

test('webhooks: CloudTalk aliases, missing stage = category, telephony TTS at 8 kHz', async () => {
  config.sarvamApiKey = 'k';
  await hook('/voice/incoming', { caller_number: CALLER });
  const lang = await hook('/voice/dtmf-category', { from: CALLER, digits: '2', stage: 'language' });
  assert.equal(lang.json.data.session.languageCode, 'mr-IN');
  const cat = await hook('/voice/dtmf-category', { contact_phone: CALLER, dtmf: '2' });
  assert.deepEqual(cat.json.data.session, { languageCode: 'mr-IN', category: 'agri' });
  assert.equal(cat.json.data.audioBase64, 'UklGRg==');
  assert.ok(sarvam.calls.every((c) => c.json.speech_sample_rate === 8000));
  const bad = await hook('/voice/incoming', { caller_number: 'unknown' });
  assert.equal(bad.status, 400);
});

test('simulator TTS is 22.05 kHz for the browser', async () => {
  config.sarvamApiKey = 'k';
  await sim({ callerPhone: CALLER, stage: 'greeting' });
  assert.equal(sarvam.calls.at(-1).json.speech_sample_rate, 22050);
});

test('call-to-SMS receipt: real webhook sends via CloudTalk (sent / failed); simulator never sends', async () => {
  Object.assign(config.cloudtalk, { apiKeyId: 'id', apiSecret: 'secret' });
  await hook('/voice/incoming', { caller_number: CALLER });
  await hook('/voice/dtmf-category', { caller_number: CALLER, dtmf_digit: '3', stage: 'language' });
  await hook('/voice/dtmf-category', { caller_number: CALLER, dtmf_digit: '3', stage: 'category' });
  const sent = await hook('/voice/process-speech', { caller_number: CALLER, recording_url: 'https://example.invalid/r.wav', text: G5 });
  assert.equal(sent.json.data.answer.smsReceipt.delivery, 'sent');
  const smsCall = cloudtalk.calls.at(-1);
  assert.equal(smsCall.headers.authorization, `Basic ${Buffer.from('id:secret').toString('base64')}`);
  assert.deepEqual(smsCall.json, { recipient: CALLER, message: seedSchemes.getByCode('JSY').sms_summary['ta-IN'] });

  smsStatus = 500;
  const failed = await hook('/voice/process-speech', { caller_number: CALLER, text: G5 });
  assert.equal(failed.json.data.answer.smsReceipt.delivery, 'failed');

  const before = cloudtalk.calls.length;
  await sim({ callerPhone: CALLER, stage: 'speech', text: G5 });
  const simSms = await app.call('POST', '/api/sms-simulate', { body: { fromPhone: CALLER, body: 'JSY' } });
  assert.equal(simSms.json.data.delivery, 'simulated');
  assert.equal(cloudtalk.calls.length, before, 'simulators never send real SMS');
});

test('webhook secret: required as ?secret= when CLOUDTALK_WEBHOOK_SECRET is set', async () => {
  config.cloudtalk.webhookSecret = 's3cret';
  assert.equal((await hook('/voice/incoming', { caller_number: CALLER })).status, 404);
  assert.equal((await hook('/voice/incoming', { caller_number: CALLER }, '?secret=wrong')).status, 404);
  assert.equal((await hook('/voice/incoming', { caller_number: CALLER }, '?secret=s3cret')).status, 200);
  assert.equal((await sim({ callerPhone: CALLER, stage: 'greeting' })).status, 200, 'simulator is not a webhook');
});

test('SMS: G8 keyword via simulator and webhook; free text goes to the agent (mode rag)', async () => {
  const g8 = await app.call('POST', '/api/sms-simulate', { body: { fromPhone: '+919829011111', body: 'PMKISAN' } });
  assert.deepEqual(Object.keys(g8.json.data).sort(), ['charCount', 'delivery', 'matchedSchemeId', 'mode', 'replyText']);
  assert.deepEqual([g8.json.data.mode, g8.json.data.matchedSchemeId], ['keyword', 'PMKISAN']);
  assert.equal(g8.json.data.replyText, seedSchemes.getByCode('PMKISAN').sms_summary['hi-IN']);
  const wh = await hook('/sms/incoming', { from: '+919829011111', body: 'PMKISAN', languageCode: 'hi-IN' });
  assert.equal(wh.json.data.delivery, 'simulated', 'no CloudTalk credentials');
  ragUp = true;
  const free = await app.call('POST', '/api/sms-simulate', { body: { fromPhone: '+919829011111', body: 'गेहूं में पीला रतुआ रोग लगा है, क्या करें?' } });
  assert.equal(free.json.data.mode, 'rag');
  assert.ok(free.json.data.charCount <= 160);
  assert.equal(rag.calls.at(-1).json.for_voice, true);
  assert.equal((await app.call('POST', '/api/sms-simulate', { body: { fromPhone: 'x', body: 'HELP' } })).status, 400);
});

test('live events: dtmf and sms reach the event bus', async () => {
  const events = [];
  const on = (e) => events.push(e);
  eventBus.bus.on('event', on);
  await sim({ callerPhone: CALLER, stage: 'greeting' });
  await sim({ callerPhone: CALLER, stage: 'language', dtmfDigit: '1' });
  await app.call('POST', '/api/sms-simulate', { body: { fromPhone: CALLER, body: 'HELP' } });
  eventBus.bus.off('event', on);
  assert.ok(events.some((e) => e.type === 'dtmf' && e.digit === '1' && e.channel === 'ivr' && e.phone === CALLER));
  assert.ok(events.some((e) => e.type === 'sms' && e.channel === 'sms' && e.text));
});

test('ivr-simulate validation and recording URL guard', async () => {
  assert.equal((await sim({ callerPhone: CALLER, stage: 'dance' })).status, 400);
  assert.equal((await sim({ stage: 'greeting' })).status, 400);
  assert.equal(isFetchableUrl('https://recordings.cloudtalk.io/a.wav'), true);
  for (const u of ['http://example.com/a.wav', 'https://localhost/a.wav', 'https://127.0.0.1/a', 'https://10.0.0.5/a', 'https://192.168.1.2/a', 'file:///etc/passwd']) {
    assert.equal(isFetchableUrl(u), false, u);
  }
});
