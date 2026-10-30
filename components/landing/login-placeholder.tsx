"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

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
        className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
      >
        <ShieldCheck className="size-8" />
      </span>
      <h1 id="login-title" className="text-3xl font-bold text-primary-dark">
        {t.login.title}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{t.login.description}</p>
      <Button asChild variant="outline" size="lg" className="mt-8 w-full sm:w-auto">
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
          {t.login.backHome}
        </Link>
      </Button>
    </section>
  );
}
