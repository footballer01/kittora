"use client";

import type { ReactNode } from "react";
import { formatPaise } from "@/lib/money";
import { useSettings } from "@/lib/settings";
import { Price } from "./price";

/** Subtotal, shipping and total. Shipping comes from Settings; the server confirms it. */
export function OrderSummary({
  subtotalPaise,
  shipping,
  totalPaise,
  children,
  final = false,
}: {
  subtotalPaise: number;
  shipping: { feePaise: number; free: boolean; remainingPaise: number };
  totalPaise: number;
  children?: ReactNode;
  final?: boolean;
}) {
  // Before Settings load (or without a back end) the fee is unknown, not free.
  const known = useSettings((s) => s.status === "ready") || final;
  return (
    <div className="grid gap-2.5">
      <Row label="Subtotal">
        <Price paise={subtotalPaise} />
      </Row>
      <Row label="Shipping">
        {!known ? (
          <span className="text-step-n1 text-ink-muted">Confirmed at checkout</span>
        ) : shipping.feePaise > 0 ? (
          <Price paise={shipping.feePaise} />
        ) : (
          <span className="font-semibold">Free</span>
        )}
      </Row>
      {known && shipping.remainingPaise > 0 && shipping.feePaise > 0 && (
        <p className="text-step-n1 text-ink-muted">Add {formatPaise(shipping.remainingPaise)} more for free shipping.</p>
      )}
      <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">{final ? "Total" : "Estimated total"}</span>
        <Price paise={totalPaise} className="text-step-1" />
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
