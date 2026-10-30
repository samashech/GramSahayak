'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp, DEMO_PRESETS, type DemoPreset } from '@/context/AppContext';
import { LanguageCode, Role } from '@/lib/types';
import {
  Tractor,
  HeartPulse,
  Building2,
  GraduationCap,
  RotateCcw,
  Languages,
  UserCheck,
  Radio,
  Sparkles,
  Check,
} from 'lucide-react';

const LANGUAGES: Array<{ code: LanguageCode; label: string; scriptLabel: string }> = [
  { code: 'hi-IN', label: 'Hindi', scriptLabel: 'हिन्दी' },
  { code: 'mr-IN', label: 'Marathi', scriptLabel: 'मराठी' },
  { code: 'ta-IN', label: 'Tamil', scriptLabel: 'தமிழ்' },
  { code: 'en-IN', label: 'English', scriptLabel: 'English' },
];

const ROLES: Array<{ role: Role; labelKey: 'farmer' | 'asha' | 'panchayat' | 'student'; icon: React.ElementType }> = [
  { role: 'farmer', labelKey: 'farmer', icon: Tractor },
  { role: 'asha', labelKey: 'asha', icon: HeartPulse },
  { role: 'panchayat', labelKey: 'panchayat', icon: Building2 },
  { role: 'student', labelKey: 'student', icon: GraduationCap },
];

export function TopBar() {
  const pathname = usePathname();
  const {
    languageCode,
    setLanguageCode,
    role,
    setRole,
    demoUser,
    selectPreset,
    t,
    resetDemoData,
    isResetting,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleReset = async () => {
    const ok = await resetDemoData();
    if (ok) {
      setToastMessage(t.resetSuccess);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-200/60 bg-amber-50/95 backdrop-blur-md text-amber-950 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link href="/voice" className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg p-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-emerald-700 text-white font-bold text-lg shadow-sm">
              ग
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-emerald-950">
                  {t.appName}
                </span>
                <span className="hidden sm:inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300">
                  Domain 2.1
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-amber-800/80 font-medium">
                {t.appSubtitle}
              </p>
            </div>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* Language Selector */}
          <div className="relative flex items-center bg-white/80 rounded-lg border border-amber-200 shadow-xs px-2 py-1 text-xs">
            <Languages className="mr-1.5 h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
            <select
              aria-label={t.language}
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value as LanguageCode)}
              className="bg-transparent font-medium text-amber-900 focus:outline-none cursor-pointer pr-1"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.scriptLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Persona Selector */}
          <div className="relative flex items-center bg-white/80 rounded-lg border border-amber-200 shadow-xs px-2 py-1 text-xs">
            <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            <select
              aria-label={t.persona}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-transparent font-medium text-emerald-950 focus:outline-none cursor-pointer pr-1"
            >
              {ROLES.map((r) => (
                <option key={r.role} value={r.role}>
                  {t[r.labelKey]}
                </option>
              ))}
            </select>
          </div>

          {/* Judge Presets Menu */}
          <div className="relative flex items-center bg-emerald-50 rounded-lg border border-emerald-200 shadow-xs px-2 py-1 text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            <select
              aria-label={t.judgePresets}
              value={demoUser || ''}
              onChange={(e) => selectPreset((e.target.value as DemoPreset['id']) || null)}
              className="bg-transparent font-semibold text-emerald-900 focus:outline-none cursor-pointer pr-1"
            >
              <option value="">-- {t.judgePresets} --</option>
              {DEMO_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Demo Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            title={t.resetDemo}
            className="flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all disabled:opacity-50"
          >
            <RotateCcw className={`h-3 w-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isResetting ? t.resetting : t.resetDemo}</span>
          </button>

          {/* Live Projector Screen Link */}
          <Link
            href="/live"
            target="_blank"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              pathname === '/live'
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 shadow-xs'
            }`}
          >
            <Radio className="h-3 w-3 text-rose-400 animate-pulse" />
            <span>LIVE</span>
          </Link>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs py-1 px-4 text-center font-medium transition-all flex items-center justify-center gap-1">
          <Check className="h-3.5 w-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}
