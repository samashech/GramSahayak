const { LANGUAGES } = require('../config');
const { AppError } = require('../utils/response');
const dbAdapter = require('../adapters/dbAdapter');
const sarvamService = require('./sarvamService');
const groqSttService = require('./groqSttService');
const eventBus = require('./eventBus');

// Shared by POST /api/voice-chat (web) and the IVR speech stage (CloudTalk + simulator).
// Emits the /live pipeline steps audio_normalized, sarvam_stt_done, sarvam_tts_ready.

// Script-based guess when STT gives no language (Devanagari defaults to Hindi).
function languageFromScript(text) {
  if (/[஀-௿]/.test(text)) return 'ta-IN';
  if (/[ऀ-ॿ]/.test(text)) return 'hi-IN';
  return null;
}

// Audio -> text. Providers in order: Sarvam (saarika:v2.5) when SARVAM_API_KEY is set, then Groq
// Whisper (LLM_API_KEY, language hint + domain vocabulary), then the client's transcriptHint
// (browser SpeechRecognition or typed text), else ERR_STT_FAILED.
// -> {transcript, detectedLanguage, via: 'sarvam'|'groq-whisper'|'hint'}
const STT_PROVIDERS = [
  { via: 'sarvam', service: sarvamService },
  { via: 'groq-whisper', service: groqSttService },
];

async function transcribe({ audioPath, languageCode, transcriptHint, channel, phone, sessionKey }) {
  const hint = String(transcriptHint ?? '').trim();
  const providers = audioPath ? STT_PROVIDERS.filter((p) => p.service.isConfigured()) : [];
  let wav = null;
  for (const { via, service } of providers) {
    try {
      if (!wav) {
        const t0 = performance.now();
        wav = (await sarvamService.normalizeAudioToWav16k(audioPath)).buffer;
        eventBus.pipeline('audio_normalized', performance.now() - t0, { channel, phone });
      }
      const t1 = performance.now();
      const stt = await service.speechToText(wav, languageCode);
      const ms = performance.now() - t1;
      // Contract step name; `provider` tells /live which engine really transcribed.
      eventBus.pipeline('sarvam_stt_done', ms, { channel, phone, text: stt.transcript, provider: via });
      await dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'stt', detail: { via, languageCode: stt.languageCode }, latencyMs: ms });
      return {
        transcript: stt.transcript,
        detectedLanguage: stt.languageCode || languageCode || languageFromScript(stt.transcript),
        via,
      };
    } catch (err) {
      console.warn(`[voice] ${via} STT failed: ${err.message}`);
      await dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'stt', detail: { via, error: err.message }, ok: false });
    }
  }
  if (hint) {
    return { transcript: hint, detectedLanguage: languageCode || languageFromScript(hint), via: 'hint' };
  }
  throw new AppError('ERR_STT_FAILED', 'Could not understand the audio. Please try again or type your question.');
}

// Text -> {audioBase64, useBrowserTts}. 8 kHz for telephony, 22.05 kHz for the web.
async function speak(text, languageCode, { telephony = false, channel, phone } = {}) {
  const t0 = performance.now();
  const audioBase64 = await sarvamService.textToSpeech(text, LANGUAGES.includes(languageCode) ? languageCode : 'hi-IN', { telephony });
  if (audioBase64) eventBus.pipeline('sarvam_tts_ready', performance.now() - t0, { channel, phone });
  return { audioBase64, useBrowserTts: !audioBase64 };
}

module.exports = { transcribe, speak, languageFromScript };
