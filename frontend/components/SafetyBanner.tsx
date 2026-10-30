'use client';

import React from 'react';
import { AlertTriangle, Phone } from 'lucide-react';
import type { Safety } from '@/lib/types';

// Red safety banner (contract Safety): one tap-to-call button per helpline the gateway flagged.
// The safe advice itself is in the answer text (fixed, never model-written for emergencies/doses).
const HELPLINE_LABELS: Record<string, string> = {
  '108': '108 · Ambulance',
  '102': '102 · Pregnancy ambulance',
  '104': '104 · Health helpline',
  '1800-180-1551': '1800-180-1551 · Kisan Call Centre',
};

export function SafetyBanner({ safety, title }: { safety: Safety; title: string }) {
  if (!safety?.flagged) return null;
  const helplines = safety.helplines.length ? safety.helplines : ['108'];
  return (
    <div role="alert" className="gs-safety rounded-3xl border-2 border-rose-500 bg-rose-50 p-4 sm:p-5 text-rose-950 shadow-md">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0" aria-hidden="true">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-rose-900">{title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {helplines.map((h, i) => (
              <a
                key={h}
                href={`tel:${h.replace(/[^0-9]/g, '')}`}
                aria-label={`Call ${HELPLINE_LABELS[h] ?? h}`}
                className={
                  i === 0
                    ? 'inline-flex min-h-12 items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-sm'
                    : 'inline-flex min-h-12 items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-300 text-rose-900 font-bold text-sm hover:bg-rose-100'
                }
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>{HELPLINE_LABELS[h] ?? h}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Honest source label for an answer (contract AnswerData.source).
export const SOURCE_LABELS: Record<string, { label: string; tone: 'ok' | 'warn' }> = {
  rag: { label: 'verified ground truth', tone: 'ok' },
  groq: { label: 'live LLM', tone: 'ok' },
  cache: { label: 'cached response', tone: 'warn' },
  fallback: { label: 'local fallback', tone: 'warn' },
};

export function SourcePill({ source }: { source: string }) {
  const s = SOURCE_LABELS[source] ?? { label: source, tone: 'warn' as const };
  return (
    <span
      title={`source: ${source}`}
      className={
        s.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full'
          : 'bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full'
      }
    >
      {s.label}
    </span>
  );
}
