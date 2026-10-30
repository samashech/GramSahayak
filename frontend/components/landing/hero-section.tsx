"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/config";

import { LOGIN_HREF } from "./nav-items";

import heroImage from "@/public/images/hero-rice-harvest.jpg";

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-8 pb-14 sm:px-6 sm:pt-12 lg:grid-cols-2 lg:gap-12 lg:pt-16 lg:pb-20">
        <div className="min-w-0">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-primary-dark">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            {t.hero.eyebrow}
          </p>

          <h1
            id="hero-title"
            className="text-[2.5rem] leading-[1.25] font-bold text-primary-dark sm:text-5xl sm:leading-[1.25] lg:text-6xl lg:leading-[1.2]"
          >
            <span className="block">{t.hero.titleLine1}</span>
            <span className="block text-primary">{t.hero.titleLine2}</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg text-foreground/90 sm:text-xl">{t.hero.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Button asChild size="lg" className="w-full text-xl sm:w-auto">
              <Link href={LOGIN_HREF}>
                {t.hero.cta}
                <ArrowRight className="size-6" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-center text-base text-muted-foreground sm:text-left">{t.hero.helper}</p>
          </div>
        </div>

        <figure className="relative min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border-4 border-card shadow-xl sm:aspect-[16/10] lg:aspect-[4/5]">
            <Image
              src={heroImage}
              alt={t.hero.imageAlt}
              fill
              priority
              placeholder="blur"
              quality={65}
              sizes="(min-width: 1152px) 552px, (min-width: 1024px) 46vw, 100vw"
              className="object-cover object-[60%_center]"
            />
          </div>

          {/* Supported-language badge overlapping the photo */}
          <div
            aria-hidden="true"
            className="absolute -bottom-5 left-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-primary-dark px-4 py-2.5 text-base font-semibold text-background shadow-lg sm:left-6"
          >
            {LANGUAGE_OPTIONS.map((option, index) => (
              <span key={option.code} lang={option.htmlLang} className="flex items-center gap-2">
                {index > 0 && <span className="size-1.5 rounded-full bg-accent" />}
                {option.nativeName}
              </span>
            ))}
          </div>
        </figure>
      </div>
    </section>
  );
}
