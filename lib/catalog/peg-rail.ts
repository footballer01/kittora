import type { CatalogProduct } from "./types";

/** The rail needs at least this many numbered shirts; otherwise show the featured grid. */
export const MIN_PEG_RAIL = 4;

export type HomeShowcase = { kind: "rail"; products: CatalogProduct[] } | { kind: "grid"; products: CatalogProduct[] };

function byFeatured(a: CatalogProduct, b: CatalogProduct) {
  return (a.featuredPosition ?? Infinity) - (b.featuredPosition ?? Infinity) || a.name.localeCompare(b.name);
}

export function homeShowcase(products: CatalogProduct[], gridSize = 8): HomeShowcase {
  const numbered = products.filter((p) => p.number != null && p.image);
  if (numbered.length >= MIN_PEG_RAIL) {
    return { kind: "rail", products: [...numbered].sort(byFeatured) };
  }
  const featured = products.filter((p) => p.featured).sort(byFeatured);
  const rest = products.filter((p) => !p.featured).sort(byFeatured);
  return { kind: "grid", products: [...featured, ...rest].slice(0, gridSize) };
}
