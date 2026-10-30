"use client";

import { Ear, MessageSquareText, Mic, type LucideIcon } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import type { Language } from "@/lib/i18n/config";

import { SectionHeading } from "./section-heading";

const STEPS: readonly { key: "speak" | "understand" | "know"; icon: LucideIcon }[] = [
  { key: "speak", icon: Mic },
  { key: "understand", icon: Ear },
  { key: "know", icon: MessageSquareText },
];

/** Step numbers are shown in the native numeral system (१ २ ३ / ૧ ૨ ૩). */
const NUMERAL_LOCALE: Record<Language, string> = {
  hi: "hi-IN-u-nu-deva",
  mr: "mr-IN-u-nu-deva",
  gu: "gu-IN-u-nu-gujr",
};

export function HowItWorksSection() {
  const { t, language } = useLanguage();
  const numberFormat = new Intl.NumberFormat(NUMERAL_LOCALE[language]);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-card py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="how-title" title={t.howItWorks.title} />

        <ol className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Connecting line: vertical on mobile, horizontal on desktop */}
          <span
            aria-hidden="true"
            className="absolute top-8 bottom-8 left-8 w-0.5 -translate-x-1/2 bg-accent/60 md:right-[16.66%] md:bottom-auto md:left-[16.66%] md:h-0.5 md:w-auto md:translate-x-0"
          />
          {STEPS.map(({ key, icon: Icon }, index) => {
            const step = t.howItWorks[key];
            return (
              <li key={key} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span
                  aria-hidden="true"
                  className="relative z-10 flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary-dark text-accent shadow-md"
                >
                  <Icon className="size-7" />
                </span>
                <div className="min-w-0 pt-1 md:pt-0">
                  <p className="text-sm font-semibold text-primary">
                    {t.howItWorks.stepLabel} {numberFormat.format(index + 1)}
                  </p>
                  <h3 className="text-2xl font-bold text-primary-dark">{step.title}</h3>
                  <p className="mt-1 text-base text-muted-foreground sm:text-lg">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
