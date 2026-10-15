import Link from "next/link";
import { cn } from "@/lib/cn";

/** v1's mark: a "K" in a light circle, beside the KITTORA wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5 rounded-full", className)} aria-label="Kittora home">
      <span className="flex size-9 items-center justify-center rounded-full bg-ink font-heading text-[0.95rem] font-extrabold text-bg transition-transform group-hover:-rotate-6">
        K
      </span>
      <span className="font-heading text-[1.2rem] font-extrabold tracking-[-0.02em] text-ink">KITTORA</span>
    </Link>
  );
}
