const fs = require('node:fs');
const { Router } = require('express');
const { ROLES } = require('../config');
const { sendSuccess, AppError } = require('../utils/response');
const { languageCodeOr, categoryOr } = require('../utils/validate');
const { audioUpload } = require('../middlewares/upload');
const { resolveSessionUser } = require('../middlewares/sessionContext');
const agentBrain = require('../services/agentBrain');
const voicePipeline = require('../services/voicePipeline');

const router = Router();

function roleOr(value, fallback) {
  if (value == null || value === '') return fallback;
  if (!ROLES.includes(value)) throw new AppError('ERR_VALIDATION', `Invalid role: ${value}. Allowed: ${ROLES.join(', ')}`);
  return value;
}

// POST /api/chat {queryText, languageCode, category?, role, sessionId?} -> AnswerData
router.post('/chat', async (req, res) => {
  const body = req.body || {};
  const user = req.sessionUser || {};
  const answer = await agentBrain.answerQuery({
    queryText: body.queryText,
    languageCode: languageCodeOr(body.languageCode, user.language || 'hi-IN'),
    category: categoryOr(body.category),
    role: roleOr(body.role, user.role),
    channel: 'web',
    sessionKey: user.sessionKey,
    phone: user.phone,
    forVoice: false,
  });
  sendSuccess(res, answer);
});

// POST /api/voice-chat multipart: audio(file), role, category?, languageCode? (omit = auto-detect),
//   transcriptHint?, sessionId?
// -> AnswerData + {transcript, detectedLanguage, audioBase64|null (WAV 22.05 kHz), useBrowserTts}
router.post('/voice-chat', audioUpload.single('audio'), async (req, res) => {
  try {
    const body = req.body || {};
    const user = await resolveSessionUser(req); // multipart fields are parsed only now
    if (!req.file && !body.transcriptHint) throw new AppError('ERR_VALIDATION', 'Send an audio file or a transcriptHint');
    const requestedLanguage = languageCodeOr(body.languageCode, null);
    const { transcript, detectedLanguage } = await voicePipeline.transcribe({
      audioPath: req.file?.path,
      languageCode: requestedLanguage,
      transcriptHint: body.transcriptHint,
      channel: 'web',
      phone: user.phone,
      sessionKey: user.sessionKey,
    });
    const languageCode = detectedLanguage || user.language || 'hi-IN';
    const answer = await agentBrain.answerQuery({
      queryText: transcript,
      languageCode,
      category: categoryOr(body.category),
      role: roleOr(body.role, user.role),
      channel: 'web',
      sessionKey: user.sessionKey,
      phone: user.phone,
      forVoice: true,
    });
    const voice = await voicePipeline.speak(answer.answerText, languageCode, { channel: 'web', phone: user.phone });
    sendSuccess(res, { ...answer, transcript, detectedLanguage: languageCode, ...voice });
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
});

module.exports = router;
