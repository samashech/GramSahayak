const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');

const env = setupTestEnv();
const msg = require('../src/config/messages');
const { handleSmsQuery, parseKeyword } = require('../src/services/smsParserService');
const sessionService = require('../src/services/sessionService');
const dbAdapter = require('../src/adapters/dbAdapter');

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); env.cleanup(); });

const RAMESH = '+919829011111';

test('G8: PMKISAN keyword -> Hindi card text, <=160 chars, portal + helpline, fast, no LLM', async () => {
  let llmCalled = false;
  const r = await handleSmsQuery(RAMESH, 'PMKISAN', undefined, { answerFreeText: async () => { llmCalled = true; } });
  assert.equal(r.mode, 'keyword');
  assert.equal(r.matchedSchemeId, 'PMKISAN');
  assert.equal(r.languageCode, 'hi-IN', 'from the caller profile');
  assert.ok(r.charCount <= 160);
  assert.match(r.replyText, /pmkisan\.gov\.in/);
  assert.match(r.replyText, /155261/);
  assert.ok(r.latencyMs < 300, `${r.latencyMs} ms`);
  assert.equal(llmCalled, false);
});

test('keyword parsing tolerates case, spaces, hyphens and aliases', () => {
  assert.equal(parseKeyword(' pm-kisan '), 'PMKISAN');
  assert.equal(parseKeyword('kcc loan kaise milega'), 'KCC');
  assert.equal(parseKeyword('Scholarships'), 'SCHOLARSHIP');
  assert.equal(parseKeyword('pmuy'), 'UJJWALA');
  assert.equal(parseKeyword('क्या हाल है'), null);
});

test('HELP and category keywords; every fixed SMS string fits in 160 chars', async () => {
  const help = await handleSmsQuery('+919999900000', 'help', 'en-IN');
  assert.equal(help.mode, 'help');
  assert.match(help.replyText, /PMKISAN/);
  const agri = await handleSmsQuery('+919999900000', 'AGRI', 'mr-IN');
  assert.match(agri.replyText, /1800-180-1551/);
  const texts = [...Object.values(msg.SMS_HELP), ...Object.values(msg.SMS_CATEGORY_REPLIES).flatMap(Object.values)];
  for (const t of texts) assert.ok(Array.from(t).length <= 160, `${Array.from(t).length}: ${t}`);
});

test('free text without the agent: deterministic card match in the message language', async () => {
  const g5 = await handleSmsQuery('+919840033333', 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?');
  assert.deepEqual([g5.matchedSchemeId, g5.languageCode], ['JSY', 'ta-IN']);
  assert.match(g5.replyText, /nhm\.gov\.in/);
  const g7 = await handleSmsQuery('+919829044444', 'नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?');
  assert.deepEqual([g7.matchedSchemeId, g7.languageCode], ['NSP', 'hi-IN']);
  const g1mr = await handleSmsQuery('+919822022222', 'पीएम किसान योजनेसाठी कोण पात्र आहे?');
  assert.deepEqual([g1mr.matchedSchemeId, g1mr.languageCode], ['PMKISAN', 'mr-IN'], 'Devanagari + Marathi profile -> mr-IN');
  const unknown = await handleSmsQuery('+919999900000', 'क्रिकेट का स्कोर क्या है?');
  assert.equal(unknown.mode, 'help');
});

test('free text with the agent plugged in (B-06) uses it and clips to 160', async () => {
  const r = await handleSmsQuery('+919999900001', 'गेहूं में पीला रतुआ', 'hi-IN', {
    answerFreeText: async ({ maxChars }) => ({ replyText: 'क'.repeat(maxChars + 40), matchedSchemeId: null }),
  });
  assert.equal(r.mode, 'rag');
  assert.equal(r.charCount, 160);
  const failing = await handleSmsQuery('+919999900001', 'आयुष्मान कार्ड', 'hi-IN', { answerFreeText: async () => { throw new Error('rag down'); } });
  assert.deepEqual([failing.mode, failing.matchedSchemeId], ['keyword', 'PMJAY']);
});

test('SMS turns and logs land in the caller session', async () => {
  const phone = '+919829055555';
  await handleSmsQuery('98290 55555', 'UJJWALA');
  const history = await sessionService.getHistory(phone);
  assert.deepEqual(history.slice(-2).map((t) => [t.channel, t.speaker]), [['sms', 'user'], ['sms', 'assistant']]);
  const logs = await dbAdapter.listLogs({ sessionKey: phone, limit: 2 });
  assert.deepEqual(logs.map((l) => l.event_type), ['sms_out', 'sms_in']);
  await assert.rejects(handleSmsQuery('123', 'HELP'), /Invalid fromPhone/);
});
