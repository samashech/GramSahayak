'use client';

import { useEffect, useRef, useState } from 'react';
import type { SseEvent } from '@/lib/types';
import { USE_MOCKS, createMockPipelineStream } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const BACKOFF_MS = [1000, 2000, 4000, 8000, 10000];

// Live SSE feed from the Node gateway (GET /api/stream/events). Reconnects with backoff
// 1 s, 2 s, 4 s, 8 s, then every 10 s. In mock mode a rehearsal pipeline plays every 12 s.
export function useEventStream(onEvent?: (e: SseEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SseEvent | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const deliver = (e: SseEvent) => { setLastEvent(e); handler.current?.(e); };

    if (USE_MOCKS) {
      setConnected(true);
      let stop = createMockPipelineStream(deliver);
      const loop = setInterval(() => { stop(); stop = createMockPipelineStream(deliver); }, 12000);
      return () => { clearInterval(loop); stop(); };
    }

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let closed = false;

    const open = () => {
      source = new EventSource(`${API_URL}/api/stream/events`);
      source.onopen = () => { attempt = 0; setConnected(true); };
      source.onmessage = (msg) => {
        try { deliver(JSON.parse(msg.data) as SseEvent); } catch { /* ignore malformed */ }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (closed) return;
        retry = setTimeout(open, BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
        attempt += 1;
      };
    };
    open();

    return () => { closed = true; if (retry) clearTimeout(retry); source?.close(); };
  }, []);

  return { connected, lastEvent };
}
