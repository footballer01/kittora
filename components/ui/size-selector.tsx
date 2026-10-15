"use client";

import { useId } from "react";
import type { CatalogVariant } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

export const LOW_STOCK = 3;

/** Calm stock text only — no urgency styling. */
export function stockNote(v: CatalogVariant | undefined): string | null {
  if (!v || v.stock == null) return null;
  if (v.stock === 0) return `${v.size} is sold out`;
  if (v.stock <= LOW_STOCK) return `Only ${v.stock} left in ${v.size}`;
  return null;
}

/** Radio group of sizes; the selected state is styled with :has(). */
export function SizeSelector({
  variants,
  value,
  onChange,
  label = "Size",
  error,
  id,
}: {
  variants: CatalogVariant[];
  value: string | null;
  onChange: (size: string) => void;
  label?: string;
  error?: string;
  id?: string;
}) {
  const name = useId();
  const note = stockNote(variants.find((v) => v.size === value));
  return (
    <fieldset id={id} aria-describedby={error ? `${name}-err` : undefined} className="scroll-mt-28">
      <legend className="mb-3 text-step-n1 font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const soldOut = v.stock === 0;
          return (
            <label
              key={v.size}
              className={cn(
                "flex h-12 min-w-14 cursor-pointer items-center justify-center rounded-full border border-line-strong px-4 font-mono text-step-n1 font-semibold text-ink transition-colors",
                "hover:border-ink",
                "has-checked:border-ink has-checked:bg-ink has-checked:text-bg",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                "has-disabled:cursor-not-allowed has-disabled:border-line has-disabled:text-ink-muted/50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={v.size}
                checked={value === v.size}
                disabled={soldOut}
                onChange={() => onChange(v.size)}
                className="sr-only"
              />
              {v.size}
              {soldOut && <span className="sr-only">, sold out</span>}
            </label>
          );
        })}
      </div>
      <p className="mt-2.5 min-h-6 text-step-n1 text-ink-muted" aria-live="polite">
        {error ? (
          <span id={`${name}-err`} className="text-brand-text">
            {error}
          </span>
        ) : (
          note
        )}
      </p>
    </fieldset>
  );
}
