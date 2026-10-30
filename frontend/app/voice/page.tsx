'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { Mic, Sparkles } from 'lucide-react';

export default function VoicePage() {
  const { t, languageCode, role, activePreset } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Active Persona Banner */}
      {activePreset && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{activePreset.name}</span>
            <span className="text-emerald-700">({activePreset.description})</span>
          </div>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
            {activePreset.phone}
          </span>
        </div>
      )}

      {/* Main Voice Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
          {t.tabVoice} — {t.appName}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 max-w-xl mx-auto">
          {t.appSubtitle}
        </p>
      </div>

      {/* Placeholder Voice Container */}
      <div className="rounded-2xl border border-amber-200/80 bg-white/90 p-8 shadow-sm text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="relative mb-6">
          <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
            <div className="h-16 w-16 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Mic className="h-8 w-8" />
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-zinc-800">{t.pressAndSpeak}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Selected Language: <span className="font-semibold text-emerald-700">{languageCode}</span> · Role: <span className="font-semibold text-emerald-700">{role}</span>
        </p>
      </div>
    </div>
  );
}
