const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { config, LANGUAGES } = require('../config');
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
const STT_SERVICES = { sarvam: { via: 'sarvam', service: sarvamService }, groq: { via: 'groq-whisper', service: groqSttService } };

async function transcribe({ audioPath, languageCode, transcriptHint, channel, phone, sessionKey }) {
  const hint = String(transcriptHint ?? '').trim();
  const providers = audioPath
    ? config.sttOrder.map((name) => STT_SERVICES[name]).filter((p) => p && p.service.isConfigured())
    : [];
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
      dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'stt', detail: { via, languageCode: stt.languageCode }, latencyMs: ms });
      return {
        transcript: stt.transcript,
        detectedLanguage: stt.languageCode || languageCode || languageFromScript(stt.transcript),
        via,
      };
    } catch (err) {
      console.warn(`[voice] ${via} STT failed: ${err.message}`);
      dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'stt', detail: { via, error: err.message }, ok: false });
    }
  }
  if (hint) {
    return { transcript: hint, detectedLanguage: languageCode || languageFromScript(hint), via: 'hint' };
  }
  throw new AppError('ERR_STT_FAILED', 'Could not understand the audio. Please try again or type your question.');
}

// Text -> {audioBase64, useBrowserTts}. 8 kHz for telephony, 22.05 kHz for the web.
// cache=true for fixed prompts (IVR menus): rendered once by Sarvam, then instant.
const ttsCache = new Map();
const TTS_CACHE_MAX = 120;

async function speak(text, languageCode, { telephony = false, channel, phone, cache = false } = {}) {
  const lang = LANGUAGES.includes(languageCode) ? languageCode : 'hi-IN';
  const key = `${lang}|${telephony ? 8 : 22}|${text}`;
  const t0 = performance.now();
  let audioBase64 = cache ? ttsCache.get(key) : null;
  if (!audioBase64) {
    // Sarvam TTS time grows with text length: synthesise sentences in parallel, then join.
    const chunks = cache ? [text] : splitForTts(text);
    if (chunks.length > 1) {
      const parts = await Promise.all(chunks.map((c) => sarvamService.textToSpeech(c, lang, { telephony })));
      audioBase64 = parts.every(Boolean) ? concatWavs(parts) : null;
    } else {
      audioBase64 = await sarvamService.textToSpeech(text, lang, { telephony });
    }
    if (audioBase64 && cache) {
      if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(key, audioBase64);
    }
  }
  if (audioBase64) eventBus.pipeline('sarvam_tts_ready', performance.now() - t0, { channel, phone, cached: cache && performance.now() - t0 < 5 });
  return { audioBase64, useBrowserTts: !audioBase64 };
}

// Sentence chunks of ~60+ characters (very short sentences are merged with the next one).
function splitForTts(text) {
  const sentences = String(text).match(/[^।.!?]+[।.!?]*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  const chunks = [];
  for (const s of sentences) {
    if (chunks.length && chunks[chunks.length - 1].length < 60) chunks[chunks.length - 1] += ` ${s}`;
    else chunks.push(s);
  }
  return chunks.length > 4 ? [chunks.slice(0, 3).join(' '), chunks.slice(3).join(' ')] : chunks;
}

// Multilingual menu: each part spoken by a voice of its own language, joined into one WAV with ffmpeg.
function concatWavs(base64Parts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-tts-'));
  try {
    const files = base64Parts.map((b64, i) => {
      const f = path.join(dir, `${i}.wav`);
      fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      return f;
    });
    const out = path.join(dir, 'out.wav');
    const inputs = files.flatMap((f) => ['-i', f]);
    const filter = `${files.map((_, i) => `[${i}:a]`).join('')}concat=n=${files.length}:v=0:a=1[a]`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[a]', out], { timeout: 8000 });
    return fs.readFileSync(out).toString('base64');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function speakParts(parts, { telephony = false, channel, phone } = {}) {
  const key = `parts|${telephony ? 8 : 22}|${parts.map((p) => p.join(':')).join('|')}`;
  if (ttsCache.has(key)) return { audioBase64: ttsCache.get(key), useBrowserTts: false };
  const clips = await Promise.all(parts.map(([lang, text]) => speak(text, lang, { telephony, channel, phone, cache: true })));
  if (clips.some((c) => !c.audioBase64)) return { audioBase64: null, useBrowserTts: true };
  try {
    const audioBase64 = clips.length === 1 ? clips[0].audioBase64 : concatWavs(clips.map((c) => c.audioBase64));
    ttsCache.set(key, audioBase64);
    return { audioBase64, useBrowserTts: false };
  } catch (err) {
    console.warn(`[voice] could not join greeting audio, using the first part: ${err.message}`);
    return clips[0];
  }
}

// Render the fixed IVR prompts in the background at startup so the first call is instant.
async function prewarm(prompts, { telephony = false } = {}) {
  if (!sarvamService.isConfigured()) return 0;
  let n = 0;
  for (const p of prompts) {
    const r = Array.isArray(p) ? await speakParts(p, { telephony }) : await speak(p.text, p.lang, { telephony, cache: true });
    if (r.audioBase64) n += 1;
  }
  return n;
}

module.exports = { transcribe, speak, speakParts, prewarm, languageFromScript, splitForTts };
