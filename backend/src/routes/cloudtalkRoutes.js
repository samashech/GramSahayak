const { Router } = require('express');
const { sendSuccess, AppError } = require('../utils/response');
const { languageCodeOr } = require('../utils/validate');
const { pick, FIELDS, webhookAuthorized } = require('../services/cloudtalkService');
const ivr = require('../controllers/cloudtalkController');

// CloudTalk Call Flow webhooks (CloudTalk only; the Frontend never calls these).
// Responses use the normal envelope with IvrStep / SMS result in data (scripts/test-webhooks.sh).
// Real calls: TTS at 8 kHz and real outbound SMS when CloudTalk credentials are set.
const router = Router();

router.use((req, res, next) => {
  if (!webhookAuthorized(req)) throw new AppError('ERR_NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
  next();
});

const caller = (body) => pick(body, FIELDS.caller);

// POST /api/cloudtalk/voice/incoming {caller_number}
router.post('/voice/incoming', async (req, res) => {
  const step = await ivr.callIncoming({ callerPhone: caller(req.body), telephony: true });
  sendSuccess(res, ivr.withWebhookLog(step, req.body));
});

// POST /api/cloudtalk/voice/dtmf-category {caller_number, dtmf_digit, stage: "language"|"category"}
router.post('/voice/dtmf-category', async (req, res) => {
  const step = await ivr.dtmf({
    callerPhone: caller(req.body), digit: pick(req.body, FIELDS.digit), stage: req.body?.stage, telephony: true,
  });
  sendSuccess(res, ivr.withWebhookLog(step, req.body));
});

// POST /api/cloudtalk/voice/process-speech {caller_number, recording_url, text?}
router.post('/voice/process-speech', async (req, res) => {
  const step = await ivr.processSpeech({
    callerPhone: caller(req.body),
    recordingUrl: pick(req.body, FIELDS.recording),
    text: req.body?.text,
    telephony: true,
    sendRealSms: true,
  });
  sendSuccess(res, ivr.withWebhookLog(step, req.body));
});

// POST /api/cloudtalk/sms/incoming {from, body, languageCode?}
router.post('/sms/incoming', async (req, res) => {
  const result = await ivr.smsIncoming({
    fromPhone: caller(req.body),
    body: pick(req.body, FIELDS.smsBody),
    languageCode: languageCodeOr(req.body?.languageCode, undefined),
    sendRealSms: true,
  });
  sendSuccess(res, result);
});

module.exports = router;
