"use client";

import type { CatalogProduct } from "@/lib/catalog/types";
import { useWishlist } from "@/lib/stores/wishlist";
import { ButtonLink } from "@/components/ui/button";
import { ProductCard } from "./product-card";

/** Saved jerseys, from this browser's localStorage (no accounts). */
export function WishlistView({ catalog }: { catalog: CatalogProduct[] }) {
  const slugs = useWishlist((s) => s.slugs);
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const saved = slugs.map((s) => bySlug.get(s)).filter((p): p is CatalogProduct => !!p);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <p className="text-step-n1 font-medium text-ink-muted">Saved on this device</p>
      <h1 className="mt-1 text-step-4 font-bold sm:text-step-5">Wishlist</h1>
      {saved.length > 0 ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {saved.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-[var(--radius-card)] border border-line px-6 py-16 text-center">
          <p className="font-heading text-step-2 font-bold">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-ink-muted">Tap the heart on any jersey to keep it here. Your wishlist stays in this browser.</p>
          <ButtonLink href="/shop" className="mt-6">
            Browse jerseys
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
