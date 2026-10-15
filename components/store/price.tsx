import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/cn";

/** Prices are ink by default; coral is kept for the product page's main price. */
export function Price({ paise, tone = "ink", className }: { paise: number; tone?: "ink" | "brand"; className?: string }) {
  return (
    <span className={cn("font-mono font-semibold tracking-tight tabular-nums", tone === "brand" ? "text-brand-text" : "text-ink", className)}>
      {formatPaise(paise)}
    </span>
  );
}
