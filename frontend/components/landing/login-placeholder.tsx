"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";

/**
 * Placeholder destination for the landing page CTAs.
 * The mobile OTP login form is a separate task and is intentionally NOT built here.
 */
export function LoginPlaceholder() {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="login-title" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-6 flex size-14 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <ShieldCheck className="size-7" strokeWidth={1.75} />
      </span>
      <h1 id="login-title" className="text-3xl font-semibold text-primary-dark">
        {t.login.title}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{t.login.description}</p>
      {/* OTP login is not built yet: no fake sign-in, the app works without an account. */}
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto">
        <Button asChild size="lg" className="w-full">
          <Link href="/voice">
            {t.login.continueApp}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {t.login.backHome}
          </Link>
        </Button>
      </div>
    </section>
  );
}
