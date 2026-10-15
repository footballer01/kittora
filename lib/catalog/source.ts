// Catalogue data for build-time rendering. Until Phase 2 connects Supabase,
// this reads the committed v1 import (scripts/import/products.json) and the
// compressed images copied to public/fixtures.
import imported from "@/scripts/import/products.json";
import type { Audience, CatalogProduct } from "./types";

type Imported = (typeof imported)["products"][number];

function fromImport(p: Imported): CatalogProduct {
  const img = p.images[0];
  return {
    id: p.v1Id,
    slug: p.slug,
    name: p.name,
    club: p.club,
    number: null,
    player: null,
    pricePaise: p.pricePaise ?? 0,
    audience: p.audience as Audience[],
    featured: p.featuredOnHome,
    featuredPosition: p.homePosition,
    image: img
      ? { src: `/fixtures/products/${p.slug}.webp`, width: img.width ?? 600, height: img.height ?? 380, alt: img.alt }
      : null,
    variants: p.sizes.map((s) => ({ size: s.label, stock: null })),
  };
}

export function getCatalog(): CatalogProduct[] {
  return imported.products.map(fromImport);
}
