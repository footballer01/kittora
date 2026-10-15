"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_QTY_PER_LINE = 5;

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  size: string;
  qty: number;
  /** Display only. The server re-prices every order (place_order). */
  unitPricePaise: number;
  image: string | null;
};

export const lineKey = (l: Pick<CartLine, "productId" | "size">) => `${l.productId}:${l.size}`;

/** Pure cart operations, unit-tested separately from the store. */
export const cartOps = {
  add(lines: CartLine[], line: CartLine): CartLine[] {
    const key = lineKey(line);
    const existing = lines.find((l) => lineKey(l) === key);
    if (!existing) return [...lines, { ...line, qty: clampQty(line.qty) }];
    return lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(l.qty + line.qty) } : l));
  },
  setQty(lines: CartLine[], key: string, qty: number): CartLine[] {
    if (qty <= 0) return lines.filter((l) => lineKey(l) !== key);
    return lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(qty) } : l));
  },
  remove(lines: CartLine[], key: string): CartLine[] {
    return lines.filter((l) => lineKey(l) !== key);
  },
  count: (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0),
  subtotalPaise: (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.unitPricePaise, 0),
};

function clampQty(q: number) {
  return Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(q)));
}

type CartState = {
  lines: CartLine[];
  open: boolean;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      add: (line) => set((s) => ({ lines: cartOps.add(s.lines, line) })),
      setQty: (key, qty) => set((s) => ({ lines: cartOps.setQty(s.lines, key, qty) })),
      remove: (key) => set((s) => ({ lines: cartOps.remove(s.lines, key) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "kittora-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      // Static pages render with an empty cart; CartHydrator loads it after mount.
      skipHydration: true,
    },
  ),
);
