const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { config, LANGUAGES } = require('../config');

// Sarvam AI speech layer (R3: only Node calls Sarvam).
//   STT  saarika:v2.5  POST /speech-to-text  (multipart: file, model, language_code)
//   TTS  bulbul:v3     POST /text-to-speech  (8 kHz for telephony, 22.05 kHz for the web; v2 retired)
//   MT   mayura:v1     POST /translate       (optional; never used before retrieval, R6)
// Auth header: api-subscription-key. Every function degrades instead of throwing to the user:
// STT throws (caller falls back to transcriptHint / text), TTS returns null (browser TTS).

const STT_TIMEOUT_MS = 8000;
const TTS_TIMEOUT_MS = 10000;
const TTS_MAX_CHARS = 500;

const isConfigured = () => Boolean(config.sarvamApiKey);
const headers = () => ({ 'api-subscription-key': config.sarvamApiKey });

// ffmpeg -> 16 kHz mono WAV. Without ffmpeg (or on error) the original bytes pass through.
function normalizeAudioToWav16k(inputPath) {
  return new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-i', inputPath, '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024, timeout: 8000 },
      (err, stdout) => {
        if (!err && stdout?.length) return resolve({ buffer: stdout, normalized: true });
        if (err) console.warn(`[sarvam] ffmpeg unavailable or failed, passing audio through: ${err.code || err.message}`);
        resolve({ buffer: fs.readFileSync(inputPath), normalized: false });
      },
    );
  });
}

async function postJson(path, body, timeoutMs) {
  const res = await fetch(`${config.sarvamBaseUrl}${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Sarvam ${path} -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
}

// -> {transcript, languageCode|null}. languageCode omitted = auto-detect ("unknown").
async function speechToText(wavBuffer, languageCode) {
  if (!isConfigured()) throw new Error('SARVAM_API_KEY is not set');
  const form = new FormData();
  form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', config.sarvamSttModel);
  form.append('language_code', LANGUAGES.includes(languageCode) ? languageCode : 'unknown');
  const res = await fetch(`${config.sarvamBaseUrl}/speech-to-text`, {
    method: 'POST', headers: headers(), body: form, signal: AbortSignal.timeout(STT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sarvam STT -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const body = await res.json();
  const transcript = String(body.transcript || '').trim();
  if (!transcript) throw new Error('Sarvam STT returned an empty transcript');
  return { transcript, languageCode: LANGUAGES.includes(body.language_code) ? body.language_code : null };
}

// -> base64 WAV or null (caller sets useBrowserTts).
async function textToSpeech(text, languageCode, { telephony = false } = {}) {
  if (!isConfigured() || !text) return null;
  try {
    const body = await postJson('/text-to-speech', {
      text: Array.from(text).slice(0, TTS_MAX_CHARS).join(''),
      target_language_code: LANGUAGES.includes(languageCode) ? languageCode : 'hi-IN',
      speaker: config.sarvamTtsSpeaker,
      model: config.sarvamTtsModel,
      speech_sample_rate: telephony ? 8000 : 22050,
    }, TTS_TIMEOUT_MS);
    return Array.isArray(body.audios) && body.audios[0] ? body.audios[0] : null;
  } catch (err) {
    console.warn(`[sarvam] TTS failed, browser TTS fallback: ${err.message}`);
    return null;
  }
}

async function translateText(text, sourceLang, targetLang) {
  if (!isConfigured()) return text;
  try {
    const body = await postJson('/translate', {
      input: text, source_language_code: sourceLang, target_language_code: targetLang, model: 'mayura:v1',
    }, TTS_TIMEOUT_MS);
    return body.translated_text || text;
  } catch (err) {
    console.warn(`[sarvam] translate failed, keeping source text: ${err.message}`);
    return text;
  }
}

module.exports = { isConfigured, normalizeAudioToWav16k, speechToText, textToSpeech, translateText };
