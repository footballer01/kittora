// Pure checkout rules shared by the cart, checkout and pay pages. The database
// (place_order) is the authority; these only predict what it will do.
import type { CatalogVariant } from "@/lib/catalog/types";
import type { DeliveryZone, StoreSettings } from "@/lib/settings";
import { MAX_QTY_PER_LINE } from "@/lib/stores/cart";

/** Indian mobile number as 10 digits, or null. Mirrors public.normalize_phone(). */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export const isPincode = (s: string) => /^[1-9]\d{5}$/.test(s.trim());

/** Order numbers are typed by people: ignore case, spaces and dashes. */
export const normalizeOrderNumber = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function shippingFor(subtotalPaise: number, s: Pick<StoreSettings, "shippingFeePaise" | "freeShippingThresholdPaise">) {
  const free = s.freeShippingThresholdPaise > 0 && subtotalPaise >= s.freeShippingThresholdPaise;
  const feePaise = free ? 0 : s.shippingFeePaise;
  const remainingPaise = s.freeShippingThresholdPaise > 0 && !free ? s.freeShippingThresholdPaise - subtotalPaise : 0;
  return { feePaise, free: free && s.shippingFeePaise > 0, remainingPaise };
}

/** Longest matching pincode prefix wins; no match = no estimate. */
export function deliveryEstimate(pincode: string, zones: DeliveryZone[]): DeliveryZone | null {
  if (!isPincode(pincode)) return null;
  return zones.filter((z) => pincode.startsWith(z.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}

export const formatDays = (z: Pick<DeliveryZone, "minDays" | "maxDays">) =>
  z.minDays === z.maxDays ? `${z.maxDays} day${z.maxDays === 1 ? "" : "s"}` : `${z.minDays}–${z.maxDays} days`;

export type LineIssue = { kind: "unavailable" } | { kind: "sold_out" } | { kind: "reduce"; max: number };

/**
 * What stops a cart line from being ordered, given live data. `variants` is
 * undefined when live data isn't loaded (assume fine; the server re-checks).
 * Stock null = not tracked, always orderable.
 */
export function lineIssue(qty: number, size: string, live: { available: boolean; variants?: CatalogVariant[] }): LineIssue | null {
  if (!live.available) return { kind: "unavailable" };
  if (!live.variants) return null;
  const v = live.variants.find((x) => x.size === size);
  if (!v) return { kind: "unavailable" };
  if (v.stock === 0) return { kind: "sold_out" };
  if (v.stock != null && qty > v.stock) return { kind: "reduce", max: v.stock };
  return null;
}

/** Highest quantity the + button may reach. */
export const maxQty = (stock: number | null | undefined) => Math.max(1, Math.min(MAX_QTY_PER_LINE, stock ?? MAX_QTY_PER_LINE));
