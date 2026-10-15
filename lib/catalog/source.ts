// Catalogue data for build-time rendering.
//
// `npm run build` first runs scripts/catalog/snapshot.ts. With Supabase
// configured, it reads the published catalogue with the anon key, copies every
// image and video from Storage into public/media/ (so shoppers download them
// from Cloudflare and traffic never uses Supabase egress) and writes
// .catalog/snapshot.json. Without Supabase (local dev, CI) there is no snapshot
// and the site renders the committed v1 import instead.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import imported from "@/scripts/import/products.json";
import type { Audience, CatalogEdit, CatalogProduct } from "./types";

export const SNAPSHOT_FILE = join(process.cwd(), ".catalog/snapshot.json");
export type Snapshot = { source: "supabase"; builtAt: string; products: CatalogProduct[]; edits: CatalogEdit[] };

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
    // Imported as-is: v1 states a country for some products, nothing else.
    country: p.country,
    season: null,
    kitType: null,
    fit: null,
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

/** The v1 import, always. /preview uses it so the design reference never changes. */
export function getImportCatalog(): CatalogProduct[] {
  return imported.products.map(fromImport);
}

let snapshot: Snapshot | null | undefined;
function readSnapshot(): Snapshot | null {
  if (snapshot === undefined) {
    snapshot = existsSync(SNAPSHOT_FILE) ? (JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as Snapshot) : null;
  }
  return snapshot;
}

export function getCatalog(): CatalogProduct[] {
  return readSnapshot()?.products ?? getImportCatalog();
}

/** Curated edits, published ones only. Empty without Supabase. */
export function getEdits(): CatalogEdit[] {
  return readSnapshot()?.edits ?? [];
}

/** True when pages are built from Supabase, so live price/stock lookups match by id. */
export const catalogSource = () => readSnapshot()?.source ?? "import";
