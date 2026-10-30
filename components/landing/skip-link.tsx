"use client";

import { useLanguage } from "@/components/providers/language-provider";

/** Keyboard users can jump past the header straight to the page content. */
export function SkipLink() {
  const { t } = useLanguage();

  return (
    <a
      href="#main-content"
      className="sr-only rounded-xl bg-primary-dark px-4 py-3 font-semibold text-background focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      {t.common.skipToContent}
    </a>
  );
}
