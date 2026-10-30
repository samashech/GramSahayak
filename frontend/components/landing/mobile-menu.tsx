"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { LanguagePicker } from "./language-picker";
import { LOGIN_HREF, NAV_ITEMS } from "./nav-items";

/** Slide-in navigation for phones and tablets. */
export function MobileMenu() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.header.menu} className="lg:hidden">
          <Menu className="size-7" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={t.header.closeMenu} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="text-xl">GramSathi</SheetTitle>
        </SheetHeader>

        <nav aria-label={t.header.navigation} className="px-3">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className="flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold text-primary-dark outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/50"
                  >
                    {t.nav[item.labelKey]}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-5 border-t border-border pt-4">
          <p aria-hidden="true" className="mb-3 text-sm font-semibold text-muted-foreground">
            {t.header.chooseLanguage}
          </p>
          <LanguagePicker label={t.header.chooseLanguage} variant="list" />
        </div>

        <div className="mt-auto p-5">
          <SheetClose asChild>
            <Button asChild size="lg" className="w-full">
              <Link href={LOGIN_HREF}>
                {t.nav.login}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
