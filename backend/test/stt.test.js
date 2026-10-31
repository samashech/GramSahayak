const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./helpers');
const { startStub } = require('./stubs');

const env = setupTestEnv();
const { config } = require('../src/config');
const VOCAB = require('../src/config/sttVocabulary');
const safetyService = require('../src/services/safetyService');
const groqStt = require('../src/services/groqSttService');

let stub;
const replies = [];
before(async () => {
  stub = await startStub(() => ({ json: { text: replies.shift() ?? '' } }));
  config.groqBaseUrl = stub.url;
  config.llmApiKey = 'k';
});
after(async () => { await stub.close(); env.cleanup(); });

test('vocabulary prompts never contain safety-trigger words (an echo must not fake an emergency)', () => {
  for (const [lang, prompt] of Object.entries(VOCAB)) assert.equal(safetyService.screen(prompt).flagged, false, lang);
});

test('a transcript that echoes the prompt is retried without the prompt', async () => {
  replies.push(VOCAB['ta-IN'], 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்');
  const r = await groqStt.speechToText(Buffer.from('wav'), 'ta-IN');
  assert.equal(r.transcript, 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்');
  assert.equal(stub.calls.length, 2);
  assert.match(stub.calls[0].raw.toString('utf8'), /name="prompt"/);
  assert.doesNotMatch(stub.calls[1].raw.toString('utf8'), /name="prompt"/);
});

test('two echoes in a row are an STT failure, not a transcript', async () => {
  replies.push(VOCAB['hi-IN'], VOCAB['hi-IN']);
  await assert.rejects(groqStt.speechToText(Buffer.from('wav'), 'hi-IN'), /echoed its prompt/);
});
