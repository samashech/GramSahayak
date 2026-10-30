"use client";

import { HeartPulse, Landmark, Wheat, type LucideIcon } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import type { Dictionary } from "@/lib/i18n/translations";

import { SectionHeading } from "./section-heading";

const SERVICES: readonly { key: "schemes" | "farming" | "health"; icon: LucideIcon }[] = [
  { key: "schemes", icon: Landmark },
  { key: "farming", icon: Wheat },
  { key: "health", icon: HeartPulse },
];

function ServiceCard({ icon: Icon, content }: { icon: LucideIcon; content: Dictionary["services"]["schemes"] }) {
  return (
    <li className="flex h-full gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6 md:flex-col">
      <span
        aria-hidden="true"
        className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
      >
        <Icon className="size-8" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h3 className="text-xl font-bold text-primary-dark sm:text-2xl">{content.title}</h3>
        <p className="mt-1.5 text-base text-muted-foreground sm:mt-2 sm:text-lg">{content.description}</p>
      </div>
    </li>
  );
}

export function ServicesSection() {
  const { t } = useLanguage();

  return (
    <section id="services" aria-labelledby="services-title" className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="services-title" title={t.services.title} description={t.services.subtitle} />
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {SERVICES.map(({ key, icon }) => (
            <ServiceCard key={key} icon={icon} content={t.services[key]} />
          ))}
        </ul>
      </div>
    </section>
  );
}
