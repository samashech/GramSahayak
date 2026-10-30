"use client";

import { Feather, MessageSquare, SignalLow, Type, type LucideIcon } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";

import { SectionHeading } from "./section-heading";

const FEATURES: readonly { key: "lightweight" | "lowData" | "textOption" | "sms"; icon: LucideIcon }[] = [
  { key: "lightweight", icon: Feather },
  { key: "lowData", icon: SignalLow },
  { key: "textOption", icon: Type },
  { key: "sms", icon: MessageSquare },
];

export function LowBandwidthSection() {
  const { t } = useLanguage();

  return (
    <section id="low-bandwidth" aria-labelledby="low-bandwidth-title" className="bg-primary-dark py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="low-bandwidth-title"
          title={t.lowBandwidth.title}
          description={t.lowBandwidth.description}
          tone="light"
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon }) => {
            const feature = t.lowBandwidth[key];
            return (
              <li
                key={key}
                className="flex gap-4 rounded-3xl border border-background/15 bg-background/5 p-5 lg:flex-col"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary-dark"
                >
                  <Icon className="size-6" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-background sm:text-xl">{feature.title}</h3>
                  <p className="mt-1 text-base text-background/80">{feature.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
