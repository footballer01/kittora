// Catalogue data for build-time rendering. Until Phase 2 connects Supabase,
// this reads the committed v1 import (scripts/import/products.json) and the
// compressed images copied to public/fixtures.
//
// Phase 2 plan for images: the build ("Publish changes") copies product images
// and videos from Supabase Storage into the static site, so shoppers download
// them from Cloudflare and Supabase's 5 GB/month egress is never used by traffic.
import imported from "@/scripts/import/products.json";
import type { Audience, CatalogEdit, CatalogProduct } from "./types";

type Imported = (typeof imported)["products"][number];

function fromImport(p: Imported): CatalogProduct {
  const img = p.images[0];
  const image = img
    ? { src: `/fixtures/products/${p.slug}.webp`, width: img.width ?? 600, height: img.height ?? 380, alt: img.alt }
    : null;
  return {
    id: p.v1Id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    club: p.club,
    number: null,
    player: null,
    pricePaise: p.pricePaise ?? 0,
    audience: p.audience as Audience[],
    featured: p.featuredOnHome,
    featuredPosition: p.homePosition,
    description: p.description,
    image,
    backImage: null,
    images: image ? [image] : [],
    story: null,
    video: null,
    variants: p.sizes.map((s) => ({ size: s.label, stock: null })),
  };
}

export function getCatalog(): CatalogProduct[] {
  return imported.products.map(fromImport);
}

/** Curated edits. Empty until admins create them (Phase 2 reads Supabase). */
export function getEdits(): CatalogEdit[] {
  return [];
}
