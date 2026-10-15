"use client";

import { useEffect, useState } from "react";
import { countCategories, type CategoryCounts } from "./categories";

/**
 * Category counts: starts with the build-time value, then refreshes from
 * Supabase in the browser so a category appears as soon as an admin adds a
 * product to it (no rebuild needed). Skipped when Supabase isn't configured.
 */
export function useLiveCategoryCounts(initial: CategoryCounts): CategoryCounts {
  const [counts, setCounts] = useState(initial);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let cancelled = false;
    import("@/lib/supabase/client")
      .then(({ supabase }) => supabase().from("products").select("audience").eq("published", true))
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setCounts(countCategories(data as { audience: ("men" | "women" | "kids")[] }[]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return counts;
}
