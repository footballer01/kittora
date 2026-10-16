"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { CatalogProduct, CatalogVariant } from "./types";

// Pages are built at deploy time; price and stock are read live in the browser
// (anon key, RLS: published products only) so they are never stale. One small
// query for the whole catalogue, shared by every component on the page.

export type LiveProduct = { pricePaise: number; variants: CatalogVariant[] };
type LiveState = { status: "idle" | "loading" | "ready" | "off"; bySlug: Map<string, LiveProduct> };

export const useLive = create<LiveState>(() => ({ status: "idle", bySlug: new Map() }));

type Row = { slug: string; price_paise: number; variants: { size: string; stock: number | null; position: number }[] };

export async function loadLive() {
  if (useLive.getState().status !== "idle") return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    useLive.setState({ status: "off" });
    return;
  }
  useLive.setState({ status: "loading" });
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error } = await supabase().from("products").select("slug, price_paise, variants(size, stock, position)").eq("published", true);
    if (error || !data) throw error;
    const bySlug = new Map(
      (data as Row[]).map((r) => [
        r.slug,
        { pricePaise: r.price_paise, variants: [...r.variants].sort((a, b) => a.position - b.position).map((v) => ({ size: v.size, stock: v.stock })) },
      ]),
    );
    useLive.setState({ status: "ready", bySlug });
  } catch {
    // Network or Supabase down: keep showing build-time values.
    useLive.setState({ status: "off" });
  }
}

/** Mount once (layout). */
export function LiveCatalog() {
  useEffect(() => {
    void loadLive();
  }, []);
  return null;
}

/**
 * The product with live price and stock merged in. `available` is false only
 * when live data loaded and this product is no longer published.
 */
export function useLiveProduct<P extends Pick<CatalogProduct, "slug" | "pricePaise" | "variants">>(product: P) {
  const status = useLive((s) => s.status);
  const live = useLive((s) => s.bySlug.get(product.slug));
  const loadedAny = useLive((s) => s.bySlug.size > 0);
  if (!live) return { ...product, available: !(status === "ready" && loadedAny), live: false };
  return { ...product, pricePaise: live.pricePaise, variants: live.variants.length ? live.variants : product.variants, available: true, live: true };
}

/** Live stock per slug for filters ("Size in stock"); falls back to build-time data. */
export function useLiveCatalog(list: CatalogProduct[]): CatalogProduct[] {
  const bySlug = useLive((s) => s.bySlug);
  if (!bySlug.size) return list;
  return list.map((p) => {
    const l = bySlug.get(p.slug);
    return l ? { ...p, pricePaise: l.pricePaise, variants: l.variants.length ? l.variants : p.variants } : p;
  });
}
