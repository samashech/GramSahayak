'use client';

import React from 'react';
import { Radio, Activity } from 'lucide-react';

export default function LivePage() {

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white font-bold">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white">
                GRAMSAHAYAK LIVE
              </h1>
              <p className="text-xs text-zinc-400">
                Real-Time Voice, STT, RAG & Telephony Pipeline Monitor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase">
              Online / Listening
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
          <Activity className="h-12 w-12 text-zinc-600 mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-zinc-300">Live Telephony & RAG Pipeline Monitor</h2>
          <p className="text-xs text-zinc-500 mt-2 max-w-md">
            Awaiting incoming audio / DTMF events from Node Gateway :5000 (FE-07).
          </p>
        </div>
      </div>
    </div>
  );
}
