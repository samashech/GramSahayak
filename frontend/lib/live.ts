import type { SseEvent } from './types';

// Folds the SSE stream (contract section 6) into what /live and the compact pipeline bar show.

export const PIPELINE_STEPS = [
  { step: 'audio_normalized', label: 'Audio normalised (ffmpeg 16 kHz)' },
  { step: 'sarvam_stt_done', label: 'Speech-to-text' },
  { step: 'chroma_rag_retrieved', label: 'Chroma retrieval (RAG)' },
  { step: 'groq_llm_synthesized', label: 'Answer synthesis' },
  { step: 'sarvam_tts_ready', label: 'Sarvam text-to-speech' },
  { step: 'sms_receipt_dispatched', label: 'SMS receipt' },
] as const;

export const VOICE_BUDGET_MS = 4500;

export interface LiveState {
  steps: Partial<Record<string, number>>; // step -> ms, for the current turn
  totalMs: number;
  answerMode: string | null; // 'llm' | 'extractive'
  sttProvider: string | null; // 'sarvam' | 'groq-whisper'
  voiceTurn: boolean; // current turn started with audio (STT steps already shown)
  channel: string | null;
  phone: string | null;
  lastDigit: { digit: string; at: number } | null;
  transcript: Array<{ speaker: string; text: string; channel?: string; ts: string; source?: string }>;
  sms: { text: string; delivery?: string; mode?: string; ts: string } | null;
  lastEventAt: number | null;
}

export const emptyLive = (): LiveState => ({
  steps: {}, totalMs: 0, answerMode: null, sttProvider: null, voiceTurn: false, channel: null, phone: null,
  lastDigit: null, transcript: [], sms: null, lastEventAt: null,
});

export function reduceLive(state: LiveState, e: SseEvent): LiveState {
  if (e.type === 'hello') return state;
  const at = Date.parse(e.ts) || Date.now();
  const next: LiveState = { ...state, lastEventAt: at, channel: e.channel ?? state.channel, phone: e.phone ?? state.phone };
  if (e.type === 'transcript') {
    // A new user question starts a new turn: reset the pipeline bars.
    // A user question starts a new turn, unless audio already started it (voice: STT steps come first).
    if (e.speaker !== 'assistant') {
      if (!state.voiceTurn) { next.steps = {}; next.totalMs = 0; next.sttProvider = null; }
      next.answerMode = null;
      next.voiceTurn = false;
    }
    next.transcript = [...state.transcript, { speaker: e.speaker ?? 'user', text: e.text ?? '', channel: e.channel, ts: e.ts, source: e.source }].slice(-8);
  } else if (e.type === 'pipeline' && e.step) {
    const base = e.step === 'audio_normalized' ? {} : state.steps; // audio = start of a voice turn
    if (e.step === 'audio_normalized') { next.voiceTurn = true; next.sttProvider = null; }
    next.steps = { ...base, [e.step]: e.ms ?? 0 };
    next.totalMs = Object.values(next.steps).reduce((a: number, b) => a + (b ?? 0), 0);
    if (e.step === 'groq_llm_synthesized') next.answerMode = e.mode ?? null;
    if (e.step === 'sarvam_stt_done') next.sttProvider = e.provider ?? null;
    if (e.step === 'sms_receipt_dispatched' && e.text) next.sms = { text: e.text, delivery: 'simulated', ts: e.ts };
  } else if (e.type === 'dtmf' && e.digit) {
    next.lastDigit = { digit: e.digit, at };
  } else if (e.type === 'sms') {
    if (e.direction === 'out') next.sms = { text: e.text ?? '', delivery: e.delivery, mode: e.mode, ts: e.ts };
    else { next.steps = {}; next.totalMs = 0; next.transcript = [...state.transcript, { speaker: 'user', text: e.text ?? '', channel: 'sms', ts: e.ts }].slice(-8); }
  }
  return next;
}

// "+91 98290 XXXXX" (privacy on the projector).
export function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} XXXXX` : 'XXXXX';
}
