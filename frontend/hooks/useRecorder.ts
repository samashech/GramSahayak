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

  const start = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is not supported in this browser. Type the question instead.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

  return { recording, error, start, stop };
}
