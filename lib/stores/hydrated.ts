"use client";

import { useSyncExternalStore } from "react";

type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

/** True once a persisted store has loaded from localStorage (false during the static render). */
export function useHydrated(store: Persisted): boolean {
  return useSyncExternalStore(
    (cb) => store.persist.onFinishHydration(cb),
    () => store.persist.hasHydrated(),
    () => false,
  );
}
