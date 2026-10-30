import Link from "next/link";
import { Leaf } from "lucide-react";

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
        "inline-flex min-h-12 items-center gap-2.5 rounded-xl pr-2 outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          tone === "dark" ? "bg-primary-dark text-accent" : "bg-background text-primary",
        )}
      >
        <Leaf className="size-6" strokeWidth={2.25} />
      </span>
      <span
        className={cn(
          "text-xl font-bold tracking-tight",
          tone === "dark" ? "text-primary-dark" : "text-background",
        )}
      >
        Gram<span className={tone === "dark" ? "text-primary" : "text-accent"}>Sathi</span>
      </span>
    </Link>
  );
}
