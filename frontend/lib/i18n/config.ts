/**
 * Central language configuration for GramSathi.
 *
 * Only Hindi, Marathi and Gujarati are supported. Add new languages here
 * (and a matching dictionary in `translations.ts`) — never in components.
 */

export const SUPPORTED_LANGUAGES = ["hi", "mr", "gu"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "hi";

/** Key used for both the cookie (SSR) and localStorage (client) preference. */
export const LANGUAGE_STORAGE_KEY = "gramsathi-language";

export interface LanguageOption {
  code: Language;
  /** Language name written in its own script. */
  nativeName: string;
  /** Romanised name shown as a small helper label, e.g. "Hindi". */
  romanName: string;
  /** Short glyph used as a visual badge. */
  glyph: string;
  /** BCP 47 tag used for the `lang` attribute. */
  htmlLang: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "hi", nativeName: "हिंदी", romanName: "Hindi", glyph: "अ", htmlLang: "hi" },
  { code: "mr", nativeName: "मराठी", romanName: "Marathi", glyph: "म", htmlLang: "mr" },
  { code: "gu", nativeName: "ગુજરાતી", romanName: "Gujarati", glyph: "ગ", htmlLang: "gu" },
];

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getLanguageOption(code: Language): LanguageOption {
  return LANGUAGE_OPTIONS.find((option) => option.code === code) ?? LANGUAGE_OPTIONS[0];
}
