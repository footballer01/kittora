"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Orders placed from this browser, so the pay and track pages can open them
// without retyping the phone number. Stored only on this device.
export type RecentOrder = { number: string; phone: string; totalPaise: number; placedAt: string };
export const MAX_RECENT_ORDERS = 5;

type State = {
  orders: RecentOrder[];
  remember: (o: RecentOrder) => void;
  forget: (number: string) => void;
};

export const useRecentOrders = create<State>()(
  persist(
    (set) => ({
      orders: [],
      remember: (o) => set((s) => ({ orders: [o, ...s.orders.filter((x) => x.number !== o.number)].slice(0, MAX_RECENT_ORDERS) })),
      forget: (number) => set((s) => ({ orders: s.orders.filter((x) => x.number !== number) })),
    }),
    { name: "kittora-orders", version: 1, storage: createJSONStorage(() => localStorage), partialize: (s) => ({ orders: s.orders }), skipHydration: true },
  ),
);
