"use client";

import Image from "next/image";
import Link from "next/link";
import type { CartRow } from "@/lib/checkout/use-cart-lines";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/stores/cart";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { Price } from "./price";

const ISSUE_TEXT = {
  unavailable: "No longer available — please remove it.",
  sold_out: "This size has sold out — please remove it.",
} as const;

/** One cart line: photo, name, size, quantity stepper, live price and any stock issue. */
export function CartLineItem({ row, onNavigate, size = "md" }: { row: CartRow; onNavigate?: () => void; size?: "md" | "lg" }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { line: l, key, issue } = row;
  const dead = issue && issue.kind !== "reduce";
  return (
    <li className="flex gap-4 py-4">
      <div className={cn("shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line", size === "lg" ? "w-28 sm:w-36" : "w-24", dead && "opacity-50")}>
        {l.image && <Image src={l.image} alt="" width={288} height={216} className="aspect-[4/3] w-full object-contain p-1.5" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/product/${l.slug}`} onClick={onNavigate} className={cn("line-clamp-2 leading-snug font-medium hover:underline", dead && "text-ink-muted")}>
            {l.name}
          </Link>
          {size === "lg" && <Price paise={row.unitPricePaise * l.qty} className={cn("shrink-0", dead && "text-ink-muted")} />}
        </div>
        <p className="mt-0.5 text-step-n1 text-ink-muted">
          Size {l.size}
          {size === "lg" && l.qty > 1 && <> · <Price paise={row.unitPricePaise} className="font-normal text-ink-muted" /> each</>}
        </p>
        {issue && (
          <p role="status" className="mt-1.5 text-step-n1 text-brand-text">
            {issue.kind === "reduce" ? `Only ${issue.max} left in ${l.size} — lower the quantity to continue.` : ISSUE_TEXT[issue.kind]}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {dead ? (
            <span />
          ) : (
            <div className="flex items-center rounded-full border border-line-strong">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full hover:bg-surface"
                aria-label={`Decrease quantity of ${l.name}, size ${l.size}`}
                onClick={() => setQty(key, l.qty - 1)}
              >
                <MinusIcon width={16} height={16} />
              </button>
              <span className="w-7 text-center font-mono text-step-n1 font-semibold tabular-nums" aria-live="polite">
                {l.qty}
              </span>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full hover:bg-surface disabled:opacity-40"
                aria-label={`Increase quantity of ${l.name}, size ${l.size}`}
                disabled={l.qty >= row.maxQty}
                onClick={() => setQty(key, Math.min(row.maxQty, l.qty + 1))}
              >
                <PlusIcon width={16} height={16} />
              </button>
            </div>
          )}
          {size === "md" ? (
            <Price paise={row.unitPricePaise * l.qty} className={cn(dead && "text-ink-muted")} />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => remove(key)}
          className={cn(
            "mt-2 self-start text-step-n2 underline-offset-2 hover:underline",
            dead ? "font-semibold text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
