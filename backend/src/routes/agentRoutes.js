const crypto = require('node:crypto');
const { Router } = require('express');
const { config, LANGUAGES } = require('../config');
const { envelope, AppError } = require('../utils/response');
const { categoryOr } = require('../utils/validate');
const sessionService = require('../services/sessionService');
const cloudtalkService = require('../services/cloudtalkService');
const agentBrain = require('../services/agentBrain');

// Sarvam voice agent (Samvaad) HTTPS tool, DEC-19. Sarvam runs the phone call (number, speech in/out,
// turn-taking); for every factual question it calls this tool, so the caller hears the same verified,
// safety-screened answer as the web app and IVR, and gets the same SMS receipt (R5).
//   POST /api/agent/answer  Authorization: Bearer <AGENT_TOOL_TOKEN>
//   {question, language?, caller?, call_id?, category?}
// -> envelope with data {answer, languageCode, matchedSchemeId, smsText, smsDelivery, safetyFlagged, helplines, source},
//    plus `answer` at the top level for tool templates that only read top-level fields.
const router = Router();

const LANGUAGE_NAMES = {
  hindi: 'hi-IN', hi: 'hi-IN', marathi: 'mr-IN', mr: 'mr-IN', tamil: 'ta-IN', ta: 'ta-IN',
  gujarati: 'gu-IN', gu: 'gu-IN', english: 'en-IN', en: 'en-IN',
};

// Sarvam may send "hi-IN", "hindi" or nothing; without a usable value the script decides.
function resolveLanguage(raw, question) {
  const value = String(raw ?? '').trim();
  if (LANGUAGES.includes(value)) return value;
  const named = LANGUAGE_NAMES[value.toLowerCase()];
  if (named) return named;
  if (/[஀-௿]/.test(question)) return 'ta-IN';
  if (/[઀-૿]/.test(question)) return 'gu-IN';
  if (/[ऀ-ॿ]/.test(question)) return 'hi-IN';
  return 'en-IN';
}

// Bearer token check. Without AGENT_TOOL_TOKEN the tool is open in development only.
function authorized(req) {
  const token = config.agentToolToken;
  if (!token) return !config.isProduction;
  const given = Buffer.from(String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

router.post('/answer', async (req, res) => {
  if (!authorized(req)) throw new AppError('ERR_NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
  const body = req.body || {};
  const question = String(body.question ?? body.query ?? body.text ?? '').trim();
  if (!question) throw new AppError('ERR_VALIDATION', 'question is required');
  const languageCode = resolveLanguage(body.language ?? body.languageCode, question);
  const phone = sessionService.normalizePhone(body.caller ?? body.caller_number ?? body.phone);
  const sessionKey = phone || (body.call_id ? `call:${String(body.call_id).slice(0, 64)}` : null);

  const answer = await agentBrain.answerQuery({
    queryText: question,
    languageCode,
    category: categoryOr(body.category),
    channel: 'ivr',
    sessionKey,
    phone,
    forVoice: true,
    deliverSms: phone ? (smsText) => cloudtalkService.sendSms(phone, smsText) : null,
  });
  res.json({
    ...envelope({
      answer: answer.answerText,
      languageCode,
      matchedSchemeId: answer.matchedSchemeId,
      smsText: answer.smsReceipt?.smsReceiptText ?? null,
      smsDelivery: answer.smsReceipt?.delivery ?? null,
      safetyFlagged: answer.safety.flagged,
      helplines: answer.safety.helplines,
      source: answer.source,
    }, null),
    answer: answer.answerText,
  });
});

module.exports = router;
