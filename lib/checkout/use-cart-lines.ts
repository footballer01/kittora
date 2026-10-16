"use client";

import { useLive } from "@/lib/catalog/live";
import { useSettings } from "@/lib/settings";
import { lineKey, useCart, type CartLine } from "@/lib/stores/cart";
import { lineIssue, maxQty, shippingFor, type LineIssue } from "./rules";

export type CartRow = { line: CartLine; key: string; unitPricePaise: number; issue: LineIssue | null; maxQty: number };

/** Cart lines with live price and stock, plus totals the server is expected to charge. */
export function useCartLines() {
  const lines = useCart((s) => s.lines);
  const status = useLive((s) => s.status);
  const bySlug = useLive((s) => s.bySlug);
  const settings = useSettings((s) => s.settings);
  const ready = status === "ready" && bySlug.size > 0;

  const rows: CartRow[] = lines.map((line) => {
    const live = bySlug.get(line.slug);
    const variants = ready ? live?.variants : undefined;
    return {
      line,
      key: lineKey(line),
      unitPricePaise: live?.pricePaise ?? line.unitPricePaise,
      issue: lineIssue(line.qty, line.size, { available: ready ? !!live : true, variants }),
      maxQty: maxQty(variants?.find((v) => v.size === line.size)?.stock),
    };
  });
  const orderable = rows.filter((r) => !r.issue);
  const subtotalPaise = orderable.reduce((n, r) => n + r.unitPricePaise * r.line.qty, 0);
  const shipping = shippingFor(subtotalPaise, settings);
  return {
    rows,
    count: rows.reduce((n, r) => n + r.line.qty, 0),
    blocked: rows.some((r) => r.issue),
    subtotalPaise,
    shipping,
    totalPaise: subtotalPaise + shipping.feePaise,
  };
}
