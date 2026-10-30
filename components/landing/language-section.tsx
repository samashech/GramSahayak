"use client";

import { useLanguage } from "@/components/providers/language-provider";

import { LanguagePicker } from "./language-picker";
import { SectionHeading } from "./section-heading";

export function LanguageSection() {
  const { t } = useLanguage();

  return (
    <section id="languages" aria-labelledby="languages-title" className="bg-secondary/60 py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeading
          id="languages-title"
          title={t.languageSection.title}
          description={t.languageSection.description}
        />
        <LanguagePicker label={t.languageSection.title} />
      </div>
    </section>
  );
}
