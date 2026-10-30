import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  id: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}

export function SectionHeading({
  id,
  title,
  description,
  align = "center",
  tone = "dark",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-8 max-w-2xl sm:mb-10", align === "center" && "mx-auto text-center", className)}>
      <span
        aria-hidden="true"
        className={cn("mb-4 block h-1 w-12 rounded-full bg-accent", align === "center" && "mx-auto")}
      />
      <h2
        id={id}
        className={cn(
          "text-2xl font-bold sm:text-3xl lg:text-4xl",
          tone === "dark" ? "text-primary-dark" : "text-background",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-3 text-base sm:text-lg",
            tone === "dark" ? "text-muted-foreground" : "text-background/85",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
