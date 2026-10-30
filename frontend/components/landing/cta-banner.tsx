"use client";

import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";

import { LOGIN_HREF } from "./nav-items";

export function CtaBanner() {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="cta-title" className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-3xl border-2 border-accent/60 bg-secondary p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4">
            <span
              aria-hidden="true"
              className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:flex"
            >
              <Smartphone className="size-7" />
            </span>
            <div className="min-w-0">
              <h2 id="cta-title" className="text-2xl font-bold text-primary-dark sm:text-3xl">
                {t.ctaBanner.title}
              </h2>
              <p className="mt-2 text-base text-foreground/85 sm:text-lg">{t.ctaBanner.description}</p>
            </div>
          </div>
          <Button asChild size="lg" className="w-full text-xl md:w-auto">
            <Link href={LOGIN_HREF}>
              {t.ctaBanner.cta}
              <ArrowRight className="size-6" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
