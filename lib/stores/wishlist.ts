"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Wishlist without accounts: product slugs saved in this browser only.
export const MAX_WISHLIST = 100;

export const wishlistOps = {
  toggle(slugs: string[], slug: string): string[] {
    return slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [slug, ...slugs].slice(0, MAX_WISHLIST);
  },
};

type WishlistState = { slugs: string[]; toggle: (slug: string) => void; remove: (slug: string) => void };

export const useWishlist = create<WishlistState>()(
  persist(
    (set) => ({
      slugs: [],
      toggle: (slug) => set((s) => ({ slugs: wishlistOps.toggle(s.slugs, slug) })),
      remove: (slug) => set((s) => ({ slugs: s.slugs.filter((x) => x !== slug) })),
    }),
    {
      name: "kittora-wishlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ slugs: s.slugs }),
      // Rehydrated after mount by CartHydrator, like the cart.
      skipHydration: true,
    },
  ),
);
