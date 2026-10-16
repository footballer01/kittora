// Maps Supabase rows (as read with the anon key at build time) to the
// catalogue shape the pages render. Pure, so it is unit-tested without a database.
import type { Audience, CatalogEdit, CatalogImage, CatalogProduct, KitType } from "./types";

/** Static path that a storage object is copied to by scripts/catalog/snapshot.ts. */
export const mediaSrc = (storagePath: string) => `/media/${storagePath.replace(/^\/+/, "")}`;

export const PRODUCT_SELECT =
  "id, slug, sku, name, club, country, player, number, season, kit_type, fit, audience, description, story, story_title, video, price_paise, track_stock, featured, featured_position, created_at, product_images(storage_path, width, height, alt, kind, position), variants(size, stock, position)";
export const EDIT_SELECT = "slug, title, description, position, edit_items(product_id, position)";

export type DbImage = { storage_path: string; width: number | null; height: number | null; alt: string; kind: "front" | "back" | "detail" | "other"; position: number };
export type DbProduct = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  club: string | null;
  country: string | null;
  player: string | null;
  number: number | null;
  season: string | null;
  kit_type: KitType | null;
  fit: string | null;
  audience: Audience[];
  description: string | null;
  story: string | null;
  story_title: string | null;
  video: { path: string; poster: string } | null;
  price_paise: number;
  track_stock: boolean;
  featured: boolean;
  featured_position: number | null;
  product_images: DbImage[];
  variants: { size: string; stock: number | null; position: number }[];
};
export type DbEdit = { slug: string; title: string; description: string | null; position: number; edit_items: { product_id: string; position: number }[] };

/**
 * Stock as the storefront sees it. Tracking off: every size is always
 * orderable (null, no low-stock text). Tracking on: the count, unset = 0.
 * Mirrors place_order() in drizzle/0008_checkout_functions.sql.
 */
export const effectiveStock = (trackStock: boolean, stock: number | null): number | null => (trackStock ? (stock ?? 0) : null);

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

function toImage(img: DbImage): CatalogImage {
  return { src: mediaSrc(img.storage_path), width: img.width ?? 600, height: img.height ?? 600, alt: img.alt };
}

export function productFromDb(row: DbProduct): CatalogProduct {
  const rows = [...row.product_images].sort(byPosition);
  const front = rows.find((i) => i.kind === "front") ?? rows.find((i) => i.kind !== "back") ?? rows[0];
  const back = rows.find((i) => i.kind === "back" && i !== front);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    club: row.club,
    country: row.country,
    season: row.season,
    kitType: row.kit_type,
    fit: row.fit,
    number: row.number,
    player: row.player,
    pricePaise: row.price_paise,
    audience: row.audience,
    featured: row.featured,
    featuredPosition: row.featured_position,
    description: row.description,
    image: front ? toImage(front) : null,
    backImage: back ? toImage(back) : null,
    images: [front, ...rows.filter((i) => i !== front)].filter((i): i is DbImage => !!i).map(toImage),
    story: row.story ? { title: row.story_title, body: row.story } : null,
    video: row.video ? { src: mediaSrc(row.video.path), poster: mediaSrc(row.video.poster) } : null,
    variants: [...row.variants].sort(byPosition).map((v) => ({ size: v.size, stock: effectiveStock(row.track_stock, v.stock) })),
  };
}

export function editFromDb(row: DbEdit, productIds: Set<string>): CatalogEdit {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    productIds: [...row.edit_items]
      .sort(byPosition)
      .map((i) => i.product_id)
      .filter((id) => productIds.has(id)),
  };
}

/** Every storage object the static site needs, as [bucket, path]. */
export function mediaObjects(rows: DbProduct[]): [string, string][] {
  return rows.flatMap((r) => [
    ...r.product_images.map((i): [string, string] => ["product-images", i.storage_path]),
    ...(r.video ? ([["product-media", r.video.path], ["product-media", r.video.poster]] as [string, string][]) : []),
  ]);
}
