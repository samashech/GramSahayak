const fs = require('node:fs');
const { Router } = require('express');
const { sendSuccess, AppError } = require('../utils/response');
const { languageCodeOr } = require('../utils/validate');
const { audioUpload } = require('../middlewares/upload');
const ivr = require('../controllers/cloudtalkController');

// Browser simulators (Tab 2 and Tab 3, the primary demo path, DR-02). They run the same
// controller functions as the CloudTalk webhooks; SMS is never really sent ("simulated").
const router = Router();

const IVR_STAGES = ['greeting', 'language', 'category', 'speech', 'answer', 'goodbye'];

// POST /api/ivr-simulate {callerPhone, stage, dtmfDigit?, languageCode?, text?} or multipart (+audio) -> IvrStep
// stage = what the phone is sending: greeting (call starts), language|category (+dtmfDigit),
// speech (+text or audio), answer|goodbye (hang up).
router.post('/ivr-simulate', audioUpload.single('audio'), async (req, res) => {
  try {
    const body = req.body || {};
    const stage = body.stage || 'greeting';
    if (!IVR_STAGES.includes(stage)) throw new AppError('ERR_VALIDATION', `Invalid stage: ${stage}. Allowed: ${IVR_STAGES.join(', ')}`);
    const callerPhone = body.callerPhone;
    let step;
    let request; // what CloudTalk would send (contract section 7)
    if (stage === 'greeting') {
      step = await ivr.callIncoming({ callerPhone });
      request = { caller_number: callerPhone };
    } else if (stage === 'language' || stage === 'category') {
      step = await ivr.dtmf({ callerPhone, digit: body.dtmfDigit, stage });
      request = { caller_number: callerPhone, dtmf_digit: body.dtmfDigit ?? '', stage };
    } else if (stage === 'speech') {
      step = await ivr.processSpeech({
        callerPhone, audioPath: req.file?.path, text: body.text, languageCode: languageCodeOr(body.languageCode, undefined),
      });
      request = { caller_number: callerPhone, recording_url: req.file ? '<recording of the caller>' : null, ...(body.text ? { text: body.text } : {}) };
    } else {
      step = await ivr.hangup({ callerPhone });
      request = { caller_number: callerPhone, event: 'hangup' };
    }
    sendSuccess(res, ivr.withWebhookLog(step, request));
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
});

// POST /api/sms-simulate {fromPhone, body, languageCode?}
//   -> {replyText, charCount, matchedSchemeId|null, mode:"keyword"|"rag"|"help", delivery}
router.post('/sms-simulate', async (req, res) => {
  const body = req.body || {};
  const result = await ivr.smsIncoming({
    fromPhone: body.fromPhone,
    body: body.body,
    languageCode: languageCodeOr(body.languageCode, undefined),
  });
  sendSuccess(res, result);
});

module.exports = router;
