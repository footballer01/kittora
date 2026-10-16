import { slugify } from "./filters";
import type { CatalogProduct } from "./types";

export type Group = { name: string; slug: string; products: CatalogProduct[] };

/** Club or player pages: one per distinct stored value (never inferred). */
export function groupBy(catalog: CatalogProduct[], field: "club" | "player"): Group[] {
  const map = new Map<string, Group>();
  for (const p of catalog) {
    const name = p[field];
    if (!name) continue;
    const slug = slugify(name);
    if (!slug) continue;
    const g = map.get(slug) ?? { name, slug, products: [] };
    g.products.push(p);
    map.set(slug, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Static export needs at least one param per dynamic route. While no product
 * has a player yet, the player route builds a single placeholder that 404s
 * and is excluded from the sitemap.
 */
export const PLACEHOLDER_SLUG = "_";
export const staticParams = (groups: Group[]) => (groups.length ? groups.map((g) => ({ slug: g.slug })) : [{ slug: PLACEHOLDER_SLUG }]);
