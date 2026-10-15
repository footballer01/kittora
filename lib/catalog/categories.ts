import type { Audience, CatalogProduct } from "./types";

export const CATEGORIES: { key: Audience; label: string; href: string }[] = [
  { key: "men", label: "Men", href: "/category/men" },
  { key: "women", label: "Women", href: "/category/women" },
  { key: "kids", label: "Kids", href: "/category/kids" },
];

export type CategoryCounts = Record<Audience, number>;

export function countCategories(products: Pick<CatalogProduct, "audience">[]): CategoryCounts {
  const counts: CategoryCounts = { men: 0, women: 0, kids: 0 };
  for (const p of products) for (const a of new Set(p.audience)) counts[a]++;
  return counts;
}

/** Categories with at least one product, in menu order. */
export function visibleCategories(counts: CategoryCounts) {
  return CATEGORIES.filter((c) => counts[c.key] > 0);
}
