'use client';

import React, { useCallback, useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useEventStream } from '@/hooks/useEventStream';
import { PIPELINE_STEPS, VOICE_BUDGET_MS, emptyLive, reduceLive, type LiveState } from '@/lib/live';
import type { SseEvent } from '@/lib/types';

// Compact, collapsible latency bar for /voice and /ivr (full view: /live).
export function LivePipelineBar() {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<LiveState>(emptyLive);
  const onEvent = useCallback((e: SseEvent) => setLive((s) => reduceLive(s, e)), []);
  const { connected } = useEventStream(onEvent);
  const within = live.totalMs <= VOICE_BUDGET_MS;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/90 text-zinc-800 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="live-pipeline-steps"
        className="flex w-full min-h-12 items-center justify-between gap-2 px-4 py-2 text-xs font-semibold"
      >
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4" aria-hidden="true" />
          Live pipeline
          <span className={connected ? 'text-emerald-700' : 'text-zinc-400'}>{connected ? '● connected' : '○ offline'}</span>
        </span>
        <span className="flex items-center gap-2 font-mono">
          {live.totalMs > 0 && <span className={within ? 'text-emerald-700' : 'text-amber-700'}>{live.totalMs} ms</span>}
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </span>
      </button>
      {open && (
        <ul id="live-pipeline-steps" className="grid grid-cols-2 gap-1 px-4 pb-3 text-[11px] sm:grid-cols-3">
          {PIPELINE_STEPS.map(({ step, label }) => {
            const ms = live.steps[step];
            return (
              <li key={step} className={ms === undefined ? 'text-zinc-400' : 'text-zinc-800'}>
                {ms === undefined ? '○' : '●'} {label}
                {ms !== undefined && <span className="font-mono"> · {ms} ms</span>}
                {step === 'sarvam_stt_done' && live.sttProvider && <span className="opacity-70"> ({live.sttProvider})</span>}
                {step === 'groq_llm_synthesized' && live.answerMode && <span> ({live.answerMode})</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
