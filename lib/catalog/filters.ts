// Shop filtering, sorting and search: pure functions over the catalogue,
// plus URL (de)serialisation so every filter state is a shareable link.
import type { Audience, CatalogProduct, KitType } from "./types";

export const SORTS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name", label: "Name: A to Z" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export const KIT_TYPE_LABEL: Record<KitType, string> = { home: "Home", away: "Away", third: "Third", retro: "Retro", special: "Special edition" };
export const AUDIENCE_LABEL: Record<Audience, string> = { men: "Men", women: "Women", kids: "Kids" };
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export type ShopFilters = {
  q: string;
  club: string[];
  country: string[];
  player: string[];
  number: string[];
  size: string[];
  kit: string[];
  audience: string[];
  /** Price bounds in whole rupees; null = open. */
  min: number | null;
  max: number | null;
  sort: SortKey;
};

export const EMPTY_FILTERS: ShopFilters = { q: "", club: [], country: [], player: [], number: [], size: [], kit: [], audience: [], min: null, max: null, sort: "featured" };

type ListKey = "club" | "country" | "player" | "number" | "size" | "kit" | "audience";
export const LIST_KEYS: ListKey[] = ["club", "country", "player", "number", "size", "kit", "audience"];

/** Lower-case, accent-free, so "mbappe" finds "Mbappé". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function slugify(s: string) {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rupees(p: CatalogProduct) {
  return Math.round(p.pricePaise / 100);
}

/** A size counts as available unless its stock is known to be 0. */
export const sizeAvailable = (p: CatalogProduct, size: string) => p.variants.some((v) => v.size === size && v.stock !== 0);

function values(p: CatalogProduct, key: ListKey): string[] {
  switch (key) {
    case "club":
      return p.club ? [p.club] : [];
    case "country":
      return p.country ? [p.country] : [];
    case "player":
      return p.player ? [p.player] : [];
    case "number":
      return p.number != null ? [String(p.number)] : [];
    case "size":
      return p.variants.filter((v) => v.stock !== 0).map((v) => v.size);
    case "kit":
      return p.kitType ? [p.kitType] : [];
    case "audience":
      return p.audience;
  }
}

export function matchesQuery(p: CatalogProduct, q: string) {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = fold([p.name, p.club, p.country, p.player, p.number != null ? `#${p.number} ${p.number}` : "", p.sku, p.season, p.kitType].filter(Boolean).join(" "));
  return terms.every((t) => hay.includes(t.replace(/^#/, "")));
}

function matches(p: CatalogProduct, f: ShopFilters, skip?: ListKey | "price") {
  if (!matchesQuery(p, f.q)) return false;
  for (const key of LIST_KEYS) {
    if (key === skip || f[key].length === 0) continue;
    const have = values(p, key);
    if (!f[key].some((v) => have.includes(v))) return false;
  }
  if (skip !== "price") {
    if (f.min != null && rupees(p) < f.min) return false;
    if (f.max != null && rupees(p) > f.max) return false;
  }
  return true;
}

function sortProducts(list: CatalogProduct[], sort: SortKey) {
  const out = [...list];
  const featured = (a: CatalogProduct, b: CatalogProduct) =>
    Number(b.featured) - Number(a.featured) || (a.featuredPosition ?? Infinity) - (b.featuredPosition ?? Infinity) || a.name.localeCompare(b.name);
  if (sort === "price-asc") out.sort((a, b) => a.pricePaise - b.pricePaise || featured(a, b));
  else if (sort === "price-desc") out.sort((a, b) => b.pricePaise - a.pricePaise || featured(a, b));
  else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort(featured);
  return out;
}

export function applyFilters(list: CatalogProduct[], f: ShopFilters) {
  return sortProducts(
    list.filter((p) => matches(p, f)),
    f.sort,
  );
}

export type Facet = { key: ListKey; label: string; options: { value: string; label: string; count: number }[] };

const FACET_LABEL: Record<ListKey, string> = { club: "Club", country: "Country", player: "Player", number: "Number", size: "Size in stock", kit: "Kit type", audience: "Category" };

/**
 * Facets with counts that respect every other active filter. A facet appears
 * only when it can narrow the list (2+ values), so empty admin fields simply
 * keep their facet hidden — nothing is inferred.
 */
export function facets(list: CatalogProduct[], f: ShopFilters, hide: ListKey[] = []): Facet[] {
  return LIST_KEYS.filter((k) => !hide.includes(k))
    .map((key) => {
      const all = new Set(list.flatMap((p) => values(p, key)));
      const counts = new Map<string, number>();
      for (const p of list.filter((p) => matches(p, f, key))) for (const v of new Set(values(p, key))) counts.set(v, (counts.get(v) ?? 0) + 1);
      const options = [...all].map((value) => ({ value, label: optionLabel(key, value), count: counts.get(value) ?? 0 }));
      options.sort(optionOrder(key));
      return { key, label: FACET_LABEL[key], options };
    })
    .filter((facet) => facet.options.length >= 2 || facet.options.some((o) => f[facet.key].includes(o.value)));
}

function optionLabel(key: ListKey, value: string) {
  if (key === "kit") return KIT_TYPE_LABEL[value as KitType] ?? value;
  if (key === "audience") return AUDIENCE_LABEL[value as Audience] ?? value;
  if (key === "number") return `#${value}`;
  return value;
}

function optionOrder(key: ListKey) {
  type O = { value: string; label: string };
  if (key === "size") return (a: O, b: O) => idx(a.value) - idx(b.value);
  if (key === "number") return (a: O, b: O) => Number(a.value) - Number(b.value);
  return (a: O, b: O) => a.label.localeCompare(b.label);
}
const idx = (s: string) => (SIZE_ORDER.indexOf(s) + 1 || 99);

/** Price range across the list in rupees, or null when every price is the same. */
export function priceRange(list: CatalogProduct[]): [number, number] | null {
  if (!list.length) return null;
  const r = list.map(rupees);
  const lo = Math.min(...r);
  const hi = Math.max(...r);
  return lo === hi ? null : [lo, hi];
}

export function activeCount(f: ShopFilters) {
  return LIST_KEYS.reduce((n, k) => n + f[k].length, 0) + (f.min != null || f.max != null ? 1 : 0);
}

const num = (s: string | null) => (s && /^\d+$/.test(s) ? Number(s) : null);

export function parseFilters(search: string): ShopFilters {
  const sp = new URLSearchParams(search);
  const sort = sp.get("sort");
  const f: ShopFilters = {
    ...EMPTY_FILTERS,
    q: (sp.get("q") ?? "").slice(0, 80),
    min: num(sp.get("min")),
    max: num(sp.get("max")),
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : "featured",
  };
  for (const k of LIST_KEYS) f[k] = [...new Set(sp.getAll(k).filter(Boolean))].slice(0, 30);
  return f;
}

export function serializeFilters(f: ShopFilters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  for (const k of LIST_KEYS) for (const v of f[k]) sp.append(k, v);
  if (f.min != null) sp.set("min", String(f.min));
  if (f.max != null) sp.set("max", String(f.max));
  if (f.sort !== "featured") sp.set("sort", f.sort);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
