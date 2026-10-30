const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');

const env = setupTestEnv();

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); env.cleanup(); });

// Reads SSE `data:` events from a streaming fetch until `until(events)` is true or timeout.
async function collect(base, trigger, until, timeoutMs = 3000) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/stream/events`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buf = '';
  let triggered = false;
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline && !until(events)) {
      const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({}), 200))]);
      if (done) break;
      if (value) buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (data) events.push(JSON.parse(data.slice(6)));
      }
      if (!triggered && events.some((e) => e.type === 'hello')) { triggered = true; await trigger(); }
    }
  } finally {
    ctrl.abort();
  }
  return { res, events };
}

test('GET /api/stream/events: SSE headers, hello first, then pipeline/transcript/sms events', async () => {
  const { res, events } = await collect(app.base, async () => {
    await app.call('POST', '/api/chat', { body: { queryText: 'पीएम किसान योजना के लिए कौन पात्र है?', languageCode: 'hi-IN', role: 'farmer' }, headers: { 'x-session-id': 'sse-test-0001' } });
    await app.call('POST', '/api/sms-simulate', { body: { fromPhone: '+919999900002', body: 'PMKISAN' } });
    await app.call('POST', '/api/ivr-simulate', { body: { callerPhone: '+919999900003', stage: 'greeting' } });
    await app.call('POST', '/api/ivr-simulate', { body: { callerPhone: '+919999900003', stage: 'language', dtmfDigit: '2' } });
  }, (evs) => evs.some((e) => e.type === 'dtmf'));
  assert.match(res.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(res.headers.get('x-accel-buffering'), 'no');
  assert.equal(events[0].type, 'hello');
  const types = new Set(events.map((e) => e.type));
  for (const t of ['transcript', 'pipeline', 'sms', 'dtmf']) assert.ok(types.has(t), `missing ${t}`);
  assert.ok(events.some((e) => e.type === 'transcript' && e.speaker === 'user'));
  assert.ok(events.some((e) => e.type === 'pipeline' && e.step === 'sms_receipt_dispatched'));
  assert.deepEqual(events.filter((e) => e.type === 'sms').map((e) => e.direction), ['in', 'out']);
  assert.ok(events.every((e) => e.ts && e.type));
  // contract SSE types only
  assert.ok([...types].every((t) => ['pipeline', 'dtmf', 'transcript', 'sms', 'hello'].includes(t)), [...types].join());
});

test('the event bus has no leaked listeners after clients disconnect', async () => {
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(require('../src/services/eventBus').bus.listenerCount('event'), 0);
});

test('GET /api/docs serves HTML and an OpenAPI 3 spec covering the contract endpoints', async () => {
  const html = await fetch(`${app.base}/api/docs`);
  assert.match(html.headers.get('content-type'), /text\/html/);
  const spec = await (await fetch(`${app.base}/api/docs/openapi.json`)).json();
  assert.equal(spec.openapi, '3.0.3');
  for (const p of ['/api/chat', '/api/voice-chat', '/api/ivr-simulate', '/api/sms-simulate', '/api/stream/events', '/api/eligibility']) {
    assert.ok(spec.paths[p], p);
  }
});
