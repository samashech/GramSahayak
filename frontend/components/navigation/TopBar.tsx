'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp, DEMO_PRESETS, type DemoPreset } from '@/context/AppContext';
import { LanguageCode, Role } from '@/lib/types';
import { RotateCcw, Languages, Radio, Check, SlidersHorizontal, ChevronDown } from 'lucide-react';

const LANGUAGES: Array<{ code: LanguageCode; label: string; scriptLabel: string }> = [
  { code: 'hi-IN', label: 'Hindi', scriptLabel: 'हिन्दी' },
  { code: 'mr-IN', label: 'Marathi', scriptLabel: 'मराठी' },
  { code: 'ta-IN', label: 'Tamil', scriptLabel: 'தமிழ்' },
  { code: 'en-IN', label: 'English', scriptLabel: 'English' },
];

const ROLES: Array<{ role: Role; labelKey: 'farmer' | 'asha' | 'panchayat' | 'student' }> = [
  { role: 'farmer', labelKey: 'farmer' },
  { role: 'asha', labelKey: 'asha' },
  { role: 'panchayat', labelKey: 'panchayat' },
  { role: 'student', labelKey: 'student' },
];

// The landing page and login have their own header; the app shell shows nowhere else twice.
export const SHELL_HIDDEN_ROUTES = ['/', '/landing', '/login'];

const fieldClass =
  'h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

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
    liteMode,
    setLiteMode,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the demo menu on outside click or Escape.
  useEffect(() => {
    if (!demoOpen) return;
    const onClick = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setDemoOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDemoOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [demoOpen]);

  if (SHELL_HIDDEN_ROUTES.includes(pathname)) return null;

  const handleReset = async () => {
    const ok = await resetDemoData();
    if (ok) {
      setToastMessage(t.resetSuccess);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/voice"
          className="flex min-w-0 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-lg font-medium text-primary-foreground">
            ग
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-foreground">{t.appName}</span>
            <span className="hidden truncate text-xs text-muted-foreground md:block">{t.appSubtitle}</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
            <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <select
              aria-label={t.language}
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value as LanguageCode)}
              className="cursor-pointer bg-transparent text-foreground focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.scriptLabel}
                </option>
              ))}
            </select>
          </label>

          {/* Judge / demo controls, folded away from villagers */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setDemoOpen((open) => !open)}
              aria-expanded={demoOpen}
              aria-haspopup="true"
              className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="hidden sm:inline">Demo</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>

            {demoOpen && (
              <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-border bg-card p-4 shadow-md">
                <label className="block text-xs text-muted-foreground" htmlFor="demo-role">{t.persona}</label>
                <select id="demo-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`mt-1 ${fieldClass}`}>
                  {ROLES.map((r) => (
                    <option key={r.role} value={r.role}>{t[r.labelKey]}</option>
                  ))}
                </select>

                <label className="mt-3 block text-xs text-muted-foreground" htmlFor="demo-preset">{t.judgePresets}</label>
                <select
                  id="demo-preset"
                  value={demoUser || ''}
                  onChange={(e) => selectPreset((e.target.value as DemoPreset['id']) || null)}
                  className={`mt-1 ${fieldClass}`}
                >
                  <option value="">{t.judgePresets}</option>
                  {DEMO_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLiteMode(!liteMode)}
                    aria-pressed={liteMode}
                    title="Lite mode for slow networks (?lite=1)"
                    className={`h-10 rounded-md border text-sm transition-colors ${
                      liteMode ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-secondary'
                    }`}
                  >
                    Lite {liteMode ? 'on' : 'off'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isResetting}
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <RotateCcw className={`h-4 w-4 text-muted-foreground ${isResetting ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {isResetting ? t.resetting : t.resetDemo}
                  </button>
                </div>

                <Link
                  href="/live"
                  target="_blank"
                  className="mt-2 flex h-10 items-center justify-center gap-2 rounded-md bg-primary-dark text-sm text-primary-foreground transition-colors hover:bg-primary"
                >
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  Live pipeline view
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center justify-center gap-2 bg-primary px-4 py-1 text-xs text-primary-foreground">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}
