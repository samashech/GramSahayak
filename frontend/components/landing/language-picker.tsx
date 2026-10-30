"use client";

import { useId } from "react";
import { Check } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  /** Accessible name for the radio group. */
  label: string;
  /** "cards" for the landing section, "list" for the compact mobile menu. */
  variant?: "cards" | "list";
  className?: string;
}

/**
 * Accessible language chooser built on native radio inputs, so arrow keys,
 * Tab and screen readers work out of the box.
 */
export function LanguagePicker({ label, variant = "cards", className }: LanguagePickerProps) {
  const { language, setLanguage, t } = useLanguage();
  const groupName = useId();
  const isCards = variant === "cards";

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div className={cn(isCards ? "grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" : "flex flex-col gap-2")}>
        {LANGUAGE_OPTIONS.map((option) => {
          const checked = option.code === language;

          return (
            <label
              key={option.code}
              className={cn(
                "group relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 transition-colors",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/50",
                isCards ? "min-h-20 p-4 sm:flex-col sm:items-start sm:p-5" : "min-h-14 px-3 py-2",
                checked
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-primary-dark hover:border-primary/50 hover:bg-secondary/50",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.code}
                checked={checked}
                onChange={() => setLanguage(option.code)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                lang={option.htmlLang}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl font-bold",
                  isCards ? "size-12 text-2xl" : "size-10 text-xl",
                  checked ? "bg-background/15 text-background" : "bg-secondary text-primary",
                )}
              >
                {option.glyph}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={option.htmlLang} className={cn("font-bold", isCards ? "text-xl" : "text-lg")}>
                  {option.nativeName}
                </span>
                <span className={cn("text-sm", checked ? "text-primary-foreground/85" : "text-muted-foreground")}>
                  {option.romanName}
                </span>
              </span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full text-sm font-semibold",
                  isCards && "sm:absolute sm:top-4 sm:right-4",
                  checked ? "visible" : "invisible",
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-background text-primary">
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                </span>
                {isCards && <span className="sr-only">{t.languageSection.selected}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
