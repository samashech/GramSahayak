'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { LanguageCode, Role } from '@/lib/types';
import { getTranslation, UIStrings } from '@/lib/i18n';

export interface DemoPreset {
  id: 'farmer-hi' | 'farmer-mr' | 'asha-ta' | 'student-hi' | 'panchayat-hi';
  name: string;
  role: Role;
  languageCode: LanguageCode;
  phone: string;
  description: string;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'farmer-hi',
    name: 'Ramesh Kumar (रमेश)',
    role: 'farmer',
    languageCode: 'hi-IN',
    phone: '+919829011111',
    description: 'Farmer (Hindi) · PM-KISAN, Wheat disease Yellow Rust',
  },
  {
    id: 'farmer-mr',
    name: 'Tukaram Patil (तुकाराम)',
    role: 'farmer',
    languageCode: 'mr-IN',
    phone: '+919822022222',
    description: 'Farmer (Marathi) · Cotton Pink Bollworm IPM',
  },
  {
    id: 'asha-ta',
    name: 'Kavitha M. (கவிதா)',
    role: 'asha',
    languageCode: 'ta-IN',
    phone: '+919840033333',
    description: 'ASHA Worker (Tamil) · Pregnancy danger signs, JSY',
  },
  {
    id: 'student-hi',
    name: 'Priya Verma (प्रिया)',
    role: 'student',
    languageCode: 'hi-IN',
    phone: '+919829044444',
    description: 'Student (Hindi) · National Scholarship Portal (NSP)',
  },
  {
    id: 'panchayat-hi',
    name: 'Sunita Devi (सुनीता)',
    role: 'panchayat',
    languageCode: 'hi-IN',
    phone: '+919829055555',
    description: 'Panchayat Operator (Hindi) · Family Eligibility Check',
  },
];

interface AppContextValue {
  languageCode: LanguageCode;
  setLanguageCode: (lang: LanguageCode) => void;
  role: Role;
  setRole: (role: Role) => void;
  sessionId: string;
  demoUser: string | null;
  setDemoUser: (user: string | null) => void;
  activePreset: DemoPreset | null;
  selectPreset: (presetId: DemoPreset['id'] | null) => void;
  t: UIStrings;
  resetDemoData: () => Promise<boolean>;
  isResetting: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function getSafeStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeStorage(key: string, val: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (val === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, val);
    }
  } catch {
    // Ignore storage write failures (e.g. private browsing quota)
  }
}

function getInitialSessionId(): string {
  const existing = getSafeStorage('gs_session_id');
  if (existing) return existing;
  let newId: string;
  try {
    newId = crypto.randomUUID();
  } catch {
    newId = 'sess_' + Math.random().toString(36).substring(2, 15);
  }
  setSafeStorage('gs_session_id', newId);
  return newId;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>('session_init');
  const [languageCode, setLanguageCodeState] = useState<LanguageCode>('hi-IN');
  const [role, setRoleState] = useState<Role>('farmer');
  const [demoUser, setDemoUserState] = useState<string | null>(null);
  const [isResetting, startResetTransition] = useTransition();

  // Initialize from localStorage on mount
  useEffect(() => {
    const sid = getInitialSessionId();
    setSessionId(sid);

    const storedLang = getSafeStorage('gs_languageCode') as LanguageCode | null;
    if (storedLang && ['hi-IN', 'mr-IN', 'ta-IN', 'en-IN'].includes(storedLang)) {
      setLanguageCodeState(storedLang);
      document.documentElement.lang = storedLang.split('-')[0];
    } else {
      document.documentElement.lang = 'hi';
    }

    const storedRole = getSafeStorage('gs_role') as Role | null;
    if (storedRole && ['farmer', 'asha', 'panchayat', 'student'].includes(storedRole)) {
      setRoleState(storedRole);
    }

    const storedUser = getSafeStorage('gs_demoUser');
    if (storedUser) {
      setDemoUserState(storedUser);
    }
  }, []);

  const setLanguageCode = (code: LanguageCode) => {
    setLanguageCodeState(code);
    setSafeStorage('gs_languageCode', code);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code.split('-')[0];
    }
  };

  const setRole = (r: Role) => {
    setRoleState(r);
    setSafeStorage('gs_role', r);
  };

  const setDemoUser = (user: string | null) => {
    setDemoUserState(user);
    setSafeStorage('gs_demoUser', user);
  };

  const selectPreset = (presetId: DemoPreset['id'] | null) => {
    if (!presetId) {
      setDemoUser(null);
      return;
    }
    const preset = DEMO_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setDemoUser(preset.id);
      setRole(preset.role);
      setLanguageCode(preset.languageCode);
    }
  };

  const resetDemoData = async (): Promise<boolean> => {
    let success = false;
    startResetTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

        if (!useMocks) {
          const res = await fetch(`${apiUrl}/api/demo/reset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-session-id': sessionId,
            },
          });
          const json = await res.json();
          success = json.success;
        } else {
          success = true;
        }
      } catch (err) {
        console.warn('Demo reset fallback locally:', err);
        success = true;
      }
    });
    return success;
  };

  const activePreset = DEMO_PRESETS.find((p) => p.id === demoUser) || null;
  const t = getTranslation(languageCode);

  return (
    <AppContext.Provider
      value={{
        languageCode,
        setLanguageCode,
        role,
        setRole,
        sessionId,
        demoUser,
        setDemoUser,
        activePreset,
        selectPreset,
        t,
        resetDemoData,
        isResetting,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
