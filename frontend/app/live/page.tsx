'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Radio, MessageSquareText, PhoneCall, Globe, MessageCircle } from 'lucide-react';
import { useEventStream } from '@/hooks/useEventStream';
import { PIPELINE_STEPS, VOICE_BUDGET_MS, emptyLive, maskPhone, reduceLive, type LiveState } from '@/lib/live';
import type { SseEvent } from '@/lib/types';

// FE-07: projector screen. Everything here comes from GET /api/stream/events (R1: only the gateway).
const IDLE_FADE_MS = 60000;
const CHANNEL_BADGE: Record<string, { label: string; Icon: typeof Globe }> = {
  web: { label: 'WEB', Icon: Globe },
  ivr: { label: 'IVR CALL', Icon: PhoneCall },
  sms: { label: 'SMS', Icon: MessageCircle },
};

export default function LivePage() {
  const [live, setLive] = useState<LiveState>(emptyLive);
  const [now, setNow] = useState(() => Date.now());
  const onEvent = useCallback((e: SseEvent) => setLive((s) => reduceLive(s, e)), []);
  const { connected } = useEventStream(onEvent);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const idle = !live.lastEventAt || now - live.lastEventAt > IDLE_FADE_MS;
  const within = live.totalMs <= VOICE_BUDGET_MS;
  const maxStep = Math.max(1, ...Object.values(live.steps).map((v) => v ?? 0));
  const digitFresh = live.lastDigit && now - live.lastDigit.at < 4000;
  const badge = live.channel ? CHANNEL_BADGE[live.channel] : null;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600" aria-hidden="true">
              <Radio className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-wider sm:text-4xl">GRAMSAHAYAK LIVE</h1>
              <p className="text-base text-zinc-400">Call · Web · SMS → one Node gateway → RAG → SMS receipt</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-lg font-bold">
            <span className={`rounded-full px-4 py-1.5 ${connected ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-300'}`} role="status">
              {connected ? '● LIVE' : '○ RECONNECTING'}
            </span>
            {badge && (
              <span className="flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-black">
                <badge.Icon className="h-5 w-5" aria-hidden="true" /> {badge.label}
              </span>
            )}
            <span className="rounded-full bg-zinc-800 px-4 py-1.5 font-mono" aria-label="Caller (masked)">{maskPhone(live.phone)}</span>
          </div>
        </header>

        <div className={`mt-6 grid gap-6 transition-opacity duration-700 lg:grid-cols-3 ${idle ? 'opacity-40' : 'opacity-100'}`}>
          <section className="lg:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-950 p-6" aria-label="Pipeline latency">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="text-2xl font-extrabold">Pipeline</h2>
              <div className="text-right">
                <div className={`font-mono text-5xl font-black ${live.totalMs === 0 ? 'text-zinc-600' : within ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {live.totalMs} ms
                </div>
                <div className="text-sm text-zinc-400">voice budget &lt; {VOICE_BUDGET_MS} ms</div>
              </div>
            </div>
            <ol className="space-y-4">
              {PIPELINE_STEPS.map(({ step, label }) => {
                const ms = live.steps[step];
                const done = ms !== undefined;
                return (
                  <li key={step}>
                    <div className="mb-1 flex justify-between text-xl">
                      <span className={done ? 'font-bold text-white' : 'text-zinc-500'}>
                        {done ? '✓' : '○'} {label}
                        {step === 'groq_llm_synthesized' && live.answerMode && <span className="text-zinc-400"> ({live.answerMode})</span>}
                      </span>
                      <span className="font-mono text-zinc-300">{done ? `${ms} ms` : '—'}</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${done ? 'bg-emerald-400' : ''} transition-all duration-500`}
                        style={{ width: done ? `${Math.max(4, ((ms ?? 0) / maxStep) * 100)}%` : '0%' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-sm text-zinc-500">Steps without Sarvam (no key) or without audio are skipped, not faked.</p>
          </section>

          <section className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950 p-6" aria-label="Last keypad press">
            <h2 className="self-start text-2xl font-extrabold">Keypad (DTMF)</h2>
            <div
              className={`my-6 flex h-48 w-48 items-center justify-center rounded-full font-mono text-9xl font-black transition-all duration-300 ${
                digitFresh ? 'scale-110 bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-600'
              }`}
              aria-live="polite"
            >
              {live.lastDigit?.digit ?? '·'}
            </div>
            <p className="text-lg text-zinc-400">1 Hindi · 2 Marathi · 3 Tamil, then 1-4 topic</p>
          </section>

          <section className="lg:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-950 p-6" aria-label="Live transcript">
            <h2 className="mb-4 text-2xl font-extrabold">Transcript</h2>
            {live.transcript.length === 0 ? (
              <p className="text-xl text-zinc-500">Waiting for a call, a voice question or an SMS…</p>
            ) : (
              <ul className="space-y-3" aria-live="polite">
                {live.transcript.map((t, i) => (
                  <li key={`${t.ts}-${i}`} className={`flex ${t.speaker === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-xl leading-snug ${t.speaker === 'assistant' ? 'bg-zinc-800' : 'bg-emerald-600 text-black'}`}>
                      <div className="mb-1 text-sm font-bold uppercase opacity-70">
                        {t.speaker === 'assistant' ? 'GramSahayak' : 'Caller'} · {t.channel}{t.source ? ` · ${t.source}` : ''}
                      </div>
                      {t.text}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6" aria-label="SMS receipt">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
              <MessageSquareText className="h-6 w-6" aria-hidden="true" /> SMS receipt
            </h2>
            {live.sms ? (
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-950 p-4">
                <p className="font-mono text-lg leading-relaxed text-emerald-100">{live.sms.text}</p>
                <p className="mt-3 text-sm text-emerald-300">
                  {Array.from(live.sms.text).length} chars · verbatim scheme card (R5) · delivery: {live.sms.delivery ?? 'simulated'}
                </p>
              </div>
            ) : (
              <p className="text-xl text-zinc-500">No SMS yet</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
