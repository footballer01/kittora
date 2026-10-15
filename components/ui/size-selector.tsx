"use client";

import { useId } from "react";
import type { CatalogVariant } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

export const LOW_STOCK = 3;

export function stockNote(v: CatalogVariant | undefined): { text: string; tone: "warning" | "muted" } | null {
  if (!v || v.stock == null) return null;
  if (v.stock === 0) return { text: `${v.size} is sold out`, tone: "muted" };
  if (v.stock <= LOW_STOCK) return { text: `Only ${v.stock} left in ${v.size}`, tone: "warning" };
  return null;
}

/** Radio group of sizes. Sold-out sizes stay visible but can't be chosen. */
export function SizeSelector({
  variants,
  value,
  onChange,
  label = "Size",
  error,
}: {
  variants: CatalogVariant[];
  value: string | null;
  onChange: (size: string) => void;
  label?: string;
  error?: string;
}) {
  const name = useId();
  const note = stockNote(variants.find((v) => v.size === value));
  return (
    <fieldset aria-describedby={error ? `${name}-err` : undefined}>
      <legend className="mb-2.5 text-step-n1 font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const soldOut = v.stock === 0;
          const low = v.stock != null && v.stock > 0 && v.stock <= LOW_STOCK;
          return (
            <label key={v.size} className={cn("relative", soldOut && "cursor-not-allowed")}>
              <input
                type="radio"
                name={name}
                value={v.size}
                checked={value === v.size}
                disabled={soldOut}
                onChange={() => onChange(v.size)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-12 min-w-14 items-center justify-center rounded-full border px-4 font-mono text-step-n1 font-semibold transition-colors",
                  "border-line-strong text-ink peer-hover:border-ink",
                  "peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-ink",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                  "peer-disabled:border-line peer-disabled:text-ink-muted/60 peer-disabled:line-through",
                )}
              >
                {v.size}
              </span>
              {low && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning ring-2 ring-bg" aria-hidden />}
              {soldOut && <span className="sr-only">sold out</span>}
              {low && <span className="sr-only">only {v.stock} left</span>}
            </label>
          );
        })}
      </div>
      <p className={cn("mt-2 min-h-6 text-step-n1", note?.tone === "warning" ? "text-warning" : "text-ink-muted")} aria-live="polite">
        {error ? (
          <span id={`${name}-err`} className="text-brand-text">
            {error}
          </span>
        ) : (
          note?.text
        )}
      </p>
    </fieldset>
  );
}
