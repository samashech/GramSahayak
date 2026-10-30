"use client";

import { ChevronDown, Languages } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGE_OPTIONS, getLanguageOption, isSupportedLanguage } from "@/lib/i18n/config";

/** Compact header language selector (dropdown with native-script names). */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const current = getLanguageOption(language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t.header.chooseLanguage}: ${current.nativeName}`}
        className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-primary/25 bg-card px-3 text-base font-semibold text-primary-dark transition-colors outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/50 data-[state=open]:bg-secondary"
      >
        <Languages className="size-5 text-primary" aria-hidden="true" />
        <span lang={current.htmlLang}>{current.nativeName}</span>
        <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t.header.chooseLanguage}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (isSupportedLanguage(value)) setLanguage(value);
          }}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.code} value={option.code}>
              <span lang={option.htmlLang} className="text-lg">
                {option.nativeName}
              </span>
              <span className="ml-auto text-sm font-normal text-muted-foreground">{option.romanName}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
