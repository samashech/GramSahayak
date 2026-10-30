"use client";

import Link from "next/link";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";

import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { LOGIN_HREF, NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo label={t.common.homeLabel} />

        <nav aria-label={t.header.navigation} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-primary-dark outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/50"
                >
                  {t.nav[item.labelKey]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <Button asChild className="hidden lg:inline-flex">
            <Link href={LOGIN_HREF}>{t.nav.login}</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
