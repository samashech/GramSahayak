import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Accessible label for the home link (translated). */
  label: string;
  className?: string;
  /** Use the light variant on dark backgrounds. */
  tone?: "dark" | "light";
}

export function Logo({ label, className, tone = "dark" }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={label}
      className={cn(
        "inline-flex min-h-12 items-center gap-3 rounded-md pr-2 outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 items-center justify-center rounded-md text-lg font-medium",
          tone === "dark" ? "bg-primary text-primary-foreground" : "bg-background text-primary-dark",
        )}
      >
        ग
      </span>
      <span className={cn("text-lg font-semibold", tone === "dark" ? "text-foreground" : "text-background")}>
        ग्राम सहायक
      </span>
    </Link>
  );
}
