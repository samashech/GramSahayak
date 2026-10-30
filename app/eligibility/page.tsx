'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { ClipboardCheck } from 'lucide-react';

export default function EligibilityPage() {
  const { t } = useApp();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
          {t.eligibilityTitle}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t.eligibilitySubtitle}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-white/90 p-8 shadow-sm text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="h-16 w-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
          <ClipboardCheck className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-zinc-800">{t.eligibilityTitle}</h2>
        <p className="mt-1 text-xs text-zinc-500 max-w-md">
          {t.rulesNotice}
        </p>
      </div>
    </div>
  );
}
