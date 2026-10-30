const { Router } = require('express');
const { LANGUAGES, CATEGORIES, ROLES } = require('../config');

// B-10: GET /api/docs (contract section 6). An OpenAPI 3 spec at /api/docs/openapi.json and a page
// with a plain endpoint table (works offline at the venue) plus Swagger UI from a pinned CDN build
// when online. No extra npm dependency.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const envelope = (data) => ({
  type: 'object',
  properties: { success: { type: 'boolean' }, data, error: { nullable: true, ...ref('Error') }, timestamp: { type: 'string', format: 'date-time' } },
});
const json = (schema) => ({ 'application/json': { schema } });
const ok = (data, description = 'OK') => ({ 200: { description, content: json(envelope(data)) } });

const ENDPOINTS = [
  ['get', '/api/health', 'Node, DB, RAG and Sarvam status', null, ok({ type: 'object' })],
  ['get', '/api/schemes', 'Scheme cards (localised SchemeView). Query: category, languageCode', null, ok({ type: 'object', properties: { schemes: { type: 'array', items: ref('SchemeView') } } })],
  ['post', '/api/eligibility', 'Deterministic eligibility (R4), no LLM', { profile: ref('Profile'), languageCode: ref('LanguageCode') }, ok({ type: 'object' })],
  ['post', '/api/chat', 'Text question -> AnswerData', { queryText: { type: 'string' }, languageCode: ref('LanguageCode'), category: ref('Category'), role: ref('Role'), sessionId: { type: 'string' } }, ok(ref('AnswerData'))],
  ['post', '/api/voice-chat', 'multipart: audio, role, category?, languageCode?, transcriptHint?, sessionId? -> AnswerData + transcript, detectedLanguage, audioBase64, useBrowserTts', null, ok(ref('AnswerData'))],
  ['get', '/api/profile', 'Profile + cross-channel history (web, ivr, sms)', null, ok({ type: 'object' })],
  ['post', '/api/profile', 'Merge a partial Profile (snake_case)', ref('Profile'), ok({ type: 'object' })],
  ['post', '/api/ivr-simulate', 'Browser IVR simulator (simulated): {callerPhone, stage, dtmfDigit?, languageCode?, text?} or multipart + audio', { callerPhone: { type: 'string' }, stage: { type: 'string', enum: ['greeting', 'language', 'category', 'speech', 'answer', 'goodbye'] }, dtmfDigit: { type: 'string' }, text: { type: 'string' } }, ok(ref('IvrStep'))],
  ['post', '/api/sms-simulate', 'Browser SMS simulator (delivery: simulated)', { fromPhone: { type: 'string' }, body: { type: 'string' }, languageCode: ref('LanguageCode') }, ok({ type: 'object' })],
  ['get', '/api/stream/events', 'Server-Sent Events: data:{type, step?, ms?, channel, phone?, digit?, text?, ts}', null, { 200: { description: 'text/event-stream' } }],
  ['post', '/api/demo/reset', 'Restore the 5 demo personas (DEMO_MODE only)', null, ok({ type: 'object' })],
  ['post', '/api/schemes/ingest', 'Upload a circular (pdf/md/txt) or JSON card -> data/raw + RAG ingest', null, ok({ type: 'object' })],
  ['post', '/api/cloudtalk/voice/incoming', 'CloudTalk webhook: call start (CloudTalk only)', { caller_number: { type: 'string' } }, ok(ref('IvrStep'))],
  ['post', '/api/cloudtalk/voice/dtmf-category', 'CloudTalk webhook: DTMF', { caller_number: { type: 'string' }, dtmf_digit: { type: 'string' }, stage: { type: 'string', enum: ['language', 'category'] } }, ok(ref('IvrStep'))],
  ['post', '/api/cloudtalk/voice/process-speech', 'CloudTalk webhook: recording', { caller_number: { type: 'string' }, recording_url: { type: 'string' } }, ok(ref('IvrStep'))],
  ['post', '/api/cloudtalk/sms/incoming', 'CloudTalk webhook: inbound SMS', { from: { type: 'string' }, body: { type: 'string' } }, ok({ type: 'object' })],
];

function buildSpec() {
  const paths = {};
  for (const [method, p, summary, body, responses] of ENDPOINTS) {
    const op = {
      summary,
      parameters: [
        { name: 'x-session-id', in: 'header', schema: { type: 'string' }, description: 'Browser session UUID' },
        { name: 'x-demo-user', in: 'header', schema: { type: 'string', enum: ['farmer-hi', 'farmer-mr', 'asha-ta', 'student-hi', 'panchayat-hi'] } },
      ],
      responses,
    };
    if (body) op.requestBody = { content: json(body.$ref ? body : { type: 'object', properties: body }) };
    paths[p] = { ...(paths[p] || {}), [method]: op };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'GramSahayak Node gateway (:5000)', version: 'contract-v1', description: 'Every response uses the envelope {success, data, error, timestamp}. Source of truth: /docs/api-contract.md.' },
    paths,
    components: {
      schemas: {
        Error: { type: 'object', properties: { code: { type: 'string', enum: ['ERR_VALIDATION', 'ERR_NOT_FOUND', 'ERR_STT_FAILED', 'ERR_RATE_LIMIT', 'ERR_INTERNAL'] }, message: { type: 'string' } } },
        LanguageCode: { type: 'string', enum: LANGUAGES },
        Category: { type: 'string', enum: CATEGORIES },
        Role: { type: 'string', enum: ROLES },
        Profile: { type: 'object', description: 'snake_case, partial allowed', properties: Object.fromEntries(['role', 'language', 'occupation', 'land_hectares', 'bpl', 'age', 'gender', 'pregnant', 'annual_income', 'social_category', 'state', 'district'].map((k) => [k, {}])) },
        SchemeView: { type: 'object', properties: Object.fromEntries(['id', 'code', 'name', 'category', 'targetRole', 'benefits', 'eligibility', 'documents', 'howToApply', 'helpline', 'portalUrl', 'smsSummary'].map((k) => [k, {}])) },
        AnswerData: { type: 'object', properties: Object.fromEntries(['answerText', 'languageCode', 'category', 'matchedSchemeId', 'sources', 'smsReceipt', 'safety', 'source', 'latencyMs'].map((k) => [k, {}])) },
        IvrStep: { type: 'object', properties: Object.fromEntries(['stage', 'promptText', 'audioBase64', 'useBrowserTts', 'session', 'answer', 'webhookLog'].map((k) => [k, {}])) },
      },
    },
  };
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function page() {
  const rows = ENDPOINTS.map(([m, p, s]) => `<tr><td><code>${m.toUpperCase()}</code></td><td><code>${p}</code></td><td>${escapeHtml(s)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GramSahayak API</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px;color:#1f2937;background:#fff}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #e5e7eb;padding:6px 8px;vertical-align:top}code{font-size:13px}</style>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head><body>
<h1>GramSahayak Node gateway API</h1>
<p>Envelope on every response: <code>{success, data, error, timestamp}</code>. Headers: <code>x-session-id</code>, optional <code>x-demo-user</code>.
Spec: <a href="/api/docs/openapi.json">/api/docs/openapi.json</a>. Contract: <code>docs/api-contract.md</code>.</p>
<table>${rows}</table><div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>if (window.SwaggerUIBundle) SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger' });</script>
</body></html>`;
}

const router = Router();
router.get('/openapi.json', (req, res) => res.json(buildSpec()));
router.get('/', (req, res) => res.type('html').send(page()));

module.exports = router;
