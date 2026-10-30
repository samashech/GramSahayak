const fs = require('node:fs');
const { LANGUAGE_BY_DIGIT, CATEGORY_BY_DIGIT } = require('../config');
const { AppError } = require('../utils/response');
const msg = require('../config/messages');
const dbAdapter = require('../adapters/dbAdapter');
const sessionService = require('../services/sessionService');
const agentBrain = require('../services/agentBrain');
const voicePipeline = require('../services/voicePipeline');
const cloudtalkService = require('../services/cloudtalkService');
const smsParserService = require('../services/smsParserService');
const eventBus = require('../services/eventBus');

// B-07: IVR call flow v1 (contract section 7) and SMS flow (section 8). The real CloudTalk
// webhooks and the browser simulators (/api/ivr-simulate, /api/sms-simulate) call these same
// functions, so both behave identically (Loophole #5, DR-02). Each IVR function returns IvrStep.
//
// Returned `stage` = where the call now is:
//   greeting  -> waiting for the language digit (1 hi-IN, 2 mr-IN, 3 ta-IN)
//   language  -> language set, category menu played, waiting for 1-4
//   category  -> category set, "speak after the beep"
//   answer    -> spoken answer + SMS receipt
//   goodbye   -> call ended
// Invalid digit: re-prompt the same stage twice, then default (hi-IN / schemes).
// Silence (no digit / no speech): re-prompt once, then goodbye.

const MAX_INVALID = 2;
const STATE_TTL_MS = 30 * 60 * 1000;
const calls = new Map(); // sessionKey -> call state

function requirePhone(raw) {
  const phone = sessionService.normalizePhone(raw);
  if (!phone) throw new AppError('ERR_VALIDATION', `A valid caller phone number is required (got ${raw ?? 'nothing'})`);
  return phone;
}

function getCall(phone) {
  const now = Date.now();
  for (const [k, c] of calls) if (now - c.updatedAt > STATE_TTL_MS) calls.delete(k);
  let call = calls.get(phone);
  if (!call) {
    call = { stage: 'greeting', languageCode: 'hi-IN', category: null, invalid: 0, silence: 0, updatedAt: now };
    calls.set(phone, call);
  }
  call.updatedAt = now;
  return call;
}

const lang = (call) => msg.langOf(call.languageCode);

async function step(call, stage, promptText, { phone, telephony, answer = null }) {
  const voice = await voicePipeline.speak(promptText, call.languageCode, { telephony, channel: 'ivr', phone });
  return {
    stage,
    promptText,
    audioBase64: voice.audioBase64,
    useBrowserTts: voice.useBrowserTts,
    session: { languageCode: call.languageCode, category: call.category },
    answer,
  };
}

async function callIncoming({ callerPhone, telephony = false }) {
  const phone = requirePhone(callerPhone);
  calls.delete(phone);
  const call = getCall(phone);
  const profile = await sessionService.getProfile(phone);
  if (profile?.language) call.languageCode = profile.language;
  await dbAdapter.logCallOrSms({ sessionKey: phone, phone, channel: 'ivr', eventType: 'call_incoming', detail: { telephony } });
  // One multilingual menu, spoken with the Hindi voice.
  const voice = await voicePipeline.speak(msg.IVR.greeting, 'hi-IN', { telephony, channel: 'ivr', phone });
  return {
    stage: 'greeting',
    promptText: msg.IVR.greeting,
    audioBase64: voice.audioBase64,
    useBrowserTts: voice.useBrowserTts,
    session: { languageCode: call.languageCode, category: null },
    answer: null,
  };
}

async function hangup({ callerPhone, telephony = false }) {
  const phone = requirePhone(callerPhone);
  const call = getCall(phone);
  call.stage = 'goodbye';
  const out = await step(call, 'goodbye', msg.IVR.goodbye[lang(call)], { phone, telephony });
  calls.delete(phone);
  return out;
}

async function silence(call, phone, telephony, rePrompt) {
  call.silence += 1;
  if (call.silence > 1) return hangup({ callerPhone: phone, telephony });
  return step(call, call.stage, `${msg.IVR.silence[lang(call)]} ${rePrompt()}`, { phone, telephony });
}

// stage "language" (1-3) or "category" (1-4); a missing stage means "category" (contract section 7).
async function dtmf({ callerPhone, digit, stage, telephony = false }) {
  const phone = requirePhone(callerPhone);
  const call = getCall(phone);
  const which = stage === 'language' ? 'language' : 'category';
  const d = String(digit ?? '').trim();
  const table = which === 'language' ? LANGUAGE_BY_DIGIT : CATEGORY_BY_DIGIT;
  const menu = () => (which === 'language' ? msg.IVR.greeting : msg.IVR.categoryMenu[lang(call)]);

  if (!d) return silence(call, phone, telephony, menu);
  eventBus.emit('dtmf', { channel: 'ivr', phone, digit: d });
  await dbAdapter.logCallOrSms({ sessionKey: phone, phone, channel: 'ivr', eventType: 'dtmf', detail: { stage: which, digit: d } });

  let value = table[d];
  const chosen = Boolean(value);
  if (!value) {
    call.invalid += 1;
    if (call.invalid <= MAX_INVALID) {
      const waitingStage = which === 'language' ? 'greeting' : 'language';
      return step(call, waitingStage, `${msg.IVR.invalid[lang(call)]} ${menu()}`, { phone, telephony });
    }
    value = which === 'language' ? 'hi-IN' : 'schemes';
  }
  call.invalid = 0;
  call.silence = 0;
  if (which === 'language') {
    call.languageCode = value;
    call.stage = 'language';
    // An explicit choice becomes the caller's preferred language (SMS replies follow it);
    // the fallback default after invalid digits does not.
    if (chosen) await sessionService.updateProfile(phone, { language: value }, { phone });
    return step(call, 'language', msg.IVR.categoryMenu[lang(call)], { phone, telephony });
  }
  call.category = value;
  call.stage = 'category';
  return step(call, 'category', msg.IVR.speak[lang(call)], { phone, telephony });
}

// Recording (CloudTalk URL or simulator upload) -> STT -> agent brain (forVoice) -> TTS,
// plus the call-to-SMS receipt (Loophole #3). `text` is the typed / fallback transcript.
async function processSpeech({ callerPhone, recordingUrl, audioPath, text, languageCode, telephony = false, sendRealSms = false }) {
  const phone = requirePhone(callerPhone);
  const call = getCall(phone);
  if (languageCode) call.languageCode = languageCode;
  let downloaded = null;
  try {
    if (!audioPath && recordingUrl) downloaded = await cloudtalkService.downloadRecording(recordingUrl);
    let heard;
    try {
      heard = await voicePipeline.transcribe({
        audioPath: audioPath || downloaded, languageCode: call.languageCode, transcriptHint: text,
        channel: 'ivr', phone, sessionKey: phone,
      });
    } catch (err) {
      if (err.code !== 'ERR_STT_FAILED') throw err;
      return silence(call, phone, telephony, () => msg.IVR.speak[lang(call)]);
    }
    const answer = await agentBrain.answerQuery({
      queryText: heard.transcript,
      languageCode: call.languageCode,
      category: call.category,
      channel: 'ivr',
      sessionKey: phone,
      phone,
      forVoice: true,
      deliverSms: sendRealSms ? (smsText) => cloudtalkService.sendSms(phone, smsText) : null,
    });
    call.stage = 'answer';
    call.silence = 0;
    return step(call, 'answer', answer.answerText, { phone, telephony, answer });
  } finally {
    if (downloaded) fs.rm(downloaded, { force: true }, () => {});
  }
}

// SMS flow (contract section 8) -> {replyText, charCount, matchedSchemeId, mode, delivery}
async function smsIncoming({ fromPhone, body, languageCode, sendRealSms = false }) {
  const result = await smsParserService.handleSmsQuery(fromPhone, body, languageCode, { answerFreeText: agentBrain.answerForSms });
  eventBus.emit('sms', { channel: 'sms', phone: result.sessionKey, direction: 'in', text: String(body ?? '').trim() });
  const delivery = sendRealSms ? await cloudtalkService.sendSms(result.sessionKey, result.replyText) : 'simulated';
  eventBus.emit('sms', { channel: 'sms', phone: result.sessionKey, direction: 'out', text: result.replyText, mode: result.mode, delivery });
  return {
    replyText: result.replyText,
    charCount: result.charCount,
    matchedSchemeId: result.matchedSchemeId,
    mode: result.mode,
    delivery,
  };
}

// webhookLog for the judges' drawer: what CloudTalk would send / what we answered.
// Audio is summarised so the log stays readable.
function withWebhookLog(ivrStep, request) {
  const response = { ...ivrStep, audioBase64: ivrStep.audioBase64 ? `<wav base64, ${ivrStep.audioBase64.length} chars>` : null };
  return { ...ivrStep, webhookLog: { request, response } };
}

const _resetCalls = () => calls.clear();

module.exports = { callIncoming, dtmf, processSpeech, hangup, smsIncoming, withWebhookLog, _resetCalls };
