const { config, LANGUAGES } = require('../config');
const VOCABULARY = require('../config/sttVocabulary');

// Groq Whisper speech-to-text: used when Sarvam is not configured or fails (same LLM_API_KEY as RAG).
// The language hint is essential: without it Whisper "detected" English/Welsh on Hindi/Marathi audio.
// Audio is sent to Groq; say so in the honest-disclosure table.

const TIMEOUT_MS = 10000;
const isConfigured = () => Boolean(config.llmApiKey);

async function requestTranscript(wavBuffer, lang, prompt) {
  const form = new FormData();
  form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', config.groqSttModel);
  form.append('language', lang.slice(0, 2));
  form.append('temperature', '0');
  form.append('response_format', 'json');
  if (prompt) form.append('prompt', prompt);
  const res = await fetch(`${config.groqBaseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.llmApiKey}`, 'User-Agent': 'gramsahayak-gateway/1.0' },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Groq STT -> HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return String((await res.json()).text || '').trim();
}

// Whisper can return the prompt itself on unclear audio. 3+ prompt terms in the transcript = echo.
function echoesPrompt(transcript, prompt) {
  if (!prompt) return false;
  const terms = prompt.split(',').map((t) => t.trim()).filter((t) => t.length > 3);
  return terms.filter((t) => transcript.includes(t)).length >= 3;
}

// -> {transcript, languageCode}; throws on failure (caller falls back to the browser transcript).
async function speechToText(wavBuffer, languageCode) {
  if (!isConfigured()) throw new Error('LLM_API_KEY is not set');
  const lang = LANGUAGES.includes(languageCode) ? languageCode : 'hi-IN';
  const prompt = VOCABULARY[lang];
  let transcript = await requestTranscript(wavBuffer, lang, prompt);
  if (echoesPrompt(transcript, prompt)) {
    console.warn('[stt] Groq Whisper echoed the vocabulary prompt; retrying without it');
    transcript = await requestTranscript(wavBuffer, lang, null);
    if (echoesPrompt(transcript, prompt)) throw new Error('Groq STT echoed its prompt (unclear audio)');
  }
  if (!transcript) throw new Error('Groq STT returned an empty transcript');
  return { transcript, languageCode: lang };
}

module.exports = { isConfigured, speechToText, echoesPrompt };
