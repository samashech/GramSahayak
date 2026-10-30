import { cookies } from "next/headers";

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isSupportedLanguage, type Language } from "./config";

/**
 * Reads the saved language preference from the request cookie so the very
 * first server render is already in the user's language (no flash of Hindi
 * for a Marathi or Gujarati user).
 */
export async function getPreferredLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LANGUAGE_STORAGE_KEY)?.value;
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}
