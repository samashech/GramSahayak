'use client';

import { useCallback, useRef, useState } from 'react';

// Minimal MediaRecorder wrapper (call screen speech stage). Picks the first supported container
// (webm/opus on Chrome/Brave, ogg on Firefox, mp4 on Safari); the gateway normalises with ffmpeg.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const MAX_MS = 20000;

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is not supported in this browser. Type the question instead.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolveRef.current?.(chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null);
        resolveRef.current = null;
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      timerRef.current = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_MS);
      return true;
    } catch {
      setError('Microphone permission denied. Allow the mic or type the question.');
      return false;
    }
  }, []);

  // Stops and resolves with the recorded audio (null if nothing was captured).
  const stop = useCallback(() => new Promise<Blob | null>((resolve) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording') { resolve(null); return; }
    resolveRef.current = resolve;
    rec.stop();
  }), []);

  // Hands-free turn for the call voice agent: record until the caller has spoken and then been quiet
  // for silenceMs. Resolves null when nobody spoke within noSpeechMs (the gateway then re-prompts),
  // or when cancel() is called (hang up). Uses the mic level only; speech is transcribed on the gateway.
  const cancelRef = useRef<(() => void) | null>(null);
  const listen = useCallback(async ({ silenceMs = 1200, noSpeechMs = 7000 } = {}) => {
    if (!(await start())) return null;
    const stream = streamRef.current;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!stream || !AudioCtx) return null;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const level = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      return Math.sqrt(sum / samples.length);
    };
    return new Promise<Blob | null>((resolve) => {
      const began = Date.now();
      let floor = 0.01; // background noise, learnt in the first 300 ms
      let heard = false;
      let quietSince = 0;
      const finish = async (keep: boolean) => {
        clearInterval(tick);
        cancelRef.current = null;
        const blob = await stop();
        ctx.close().catch(() => {});
        resolve(keep ? blob : null);
      };
      const tick = setInterval(() => {
        const now = Date.now();
        const rms = level();
        if (now - began < 300) { floor = Math.max(floor, rms); return; }
        const speaking = rms > Math.max(0.02, floor * 2.5);
        if (speaking) { heard = true; quietSince = 0; }
        else if (heard && !quietSince) quietSince = now;
        if (heard && quietSince && now - quietSince > silenceMs) finish(true);
        else if (!heard && now - began > noSpeechMs) finish(false);
      }, 100);
      cancelRef.current = () => finish(false);
    });
  }, [start, stop]);

  const cancel = useCallback(() => { cancelRef.current?.(); }, []);

  return { recording, error, start, stop, listen, cancel };
}
