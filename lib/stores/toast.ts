"use client";

import { create } from "zustand";

export type Toast = { id: number; message: string; tone: "default" | "success" | "warning" };

type ToastState = {
  toasts: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const DURATION_MS = 3200;

export const useToast = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = "default") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), DURATION_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone?: Toast["tone"]) => useToast.getState().show(message, tone);
