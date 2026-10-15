import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Price({ paise, className }: { paise: number; className?: string }) {
  return <span className={cn("font-mono font-semibold tracking-tight text-brand-text tabular-nums", className)}>{formatPaise(paise)}</span>;
}
