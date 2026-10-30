"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  LANGUAGE_STORAGE_KEY,
  getLanguageOption,
  isSupportedLanguage,
  type Language,
} from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/translations";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function persistLanguage(language: Language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage can be unavailable (private mode, storage full). The cookie still works.
  }
  document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
}

interface LanguageProviderProps {
  /** Language resolved on the server from the preference cookie. */
  initialLanguage: Language;
  children: ReactNode;
}

export function LanguageProvider({ initialLanguage, children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // If the cookie was cleared but localStorage still remembers a choice, restore it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(stored) && stored !== initialLanguage) {
        setLanguageState(stored);
        persistLanguage(stored);
        return;
      }
    } catch {
      // Ignore storage access errors.
    }
    persistLanguage(initialLanguage);
  }, [initialLanguage]);

  // Keep the document language in sync for screen readers and correct font shaping.
  useEffect(() => {
    document.documentElement.lang = getLanguageOption(language).htmlLang;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    persistLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: getDictionary(language) }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>.");
  }
  return context;
}
