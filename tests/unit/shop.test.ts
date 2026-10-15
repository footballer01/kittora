import { describe, expect, it } from "vitest";
import { applyFilters, EMPTY_FILTERS, facets, parseFilters, priceRange, serializeFilters, slugify, type ShopFilters } from "@/lib/catalog/filters";
import { productFromDb, type DbProduct } from "@/lib/catalog/from-db";
import { groupBy, staticParams } from "@/lib/catalog/groups";
import type { CatalogProduct } from "@/lib/catalog/types";
import { jsonLd, productJsonLd } from "@/lib/seo";
import { MAX_WISHLIST, wishlistOps } from "@/lib/stores/wishlist";

const product = (id: string, extra: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id,
  slug: id,
  name: id,
  sku: null,
  club: null,
  country: null,
  season: null,
  kitType: null,
  fit: null,
  number: null,
  player: null,
  pricePaise: 90000,
  audience: ["men"],
  featured: false,
  featuredPosition: null,
  description: null,
  image: null,
  backImage: null,
  images: [],
  story: null,
  video: null,
  variants: [
    { size: "S", stock: null },
    { size: "M", stock: null },
  ],
  ...extra,
});

const f = (extra: Partial<ShopFilters>): ShopFilters => ({ ...EMPTY_FILTERS, ...extra });

const list = [
  product("ars", { name: "Arsenal Saka #7 Jersey", club: "Arsenal", pricePaise: 90000, featured: true, featuredPosition: 2 }),
  product("rma", { name: "Real Madrid Mbappé #10 Jersey", club: "Real Madrid", pricePaise: 120000, player: "Kylian Mbappé", number: 10, variants: [{ size: "M", stock: 0 }, { size: "L", stock: 4 }] }),
  product("arg", { name: "Argentina Striped Jersey", club: "Argentina", country: "Argentina", pricePaise: 80000, featured: true, featuredPosition: 1 }),
];
const ids = (ps: CatalogProduct[]) => ps.map((p) => p.id);

describe("shop filters", () => {
  it("sorts featured first in v1 order by default", () => {
    expect(ids(applyFilters(list, EMPTY_FILTERS))).toEqual(["arg", "ars", "rma"]);
  });

  it("sorts by price both ways", () => {
    expect(ids(applyFilters(list, f({ sort: "price-asc" })))).toEqual(["arg", "ars", "rma"]);
    expect(ids(applyFilters(list, f({ sort: "price-desc" })))).toEqual(["rma", "ars", "arg"]);
  });

  it("ORs values within a facet and ANDs across facets", () => {
    expect(ids(applyFilters(list, f({ club: ["Arsenal", "Argentina"] })))).toEqual(["arg", "ars"]);
    expect(ids(applyFilters(list, f({ club: ["Arsenal", "Real Madrid"], number: ["10"] })))).toEqual(["rma"]);
  });

  it("treats sizes with stock 0 as unavailable, unknown stock as available", () => {
    expect(ids(applyFilters(list, f({ size: ["M"] })))).toEqual(["arg", "ars"]);
    expect(ids(applyFilters(list, f({ size: ["L"] })))).toEqual(["rma"]);
  });

  it("filters by price in rupees", () => {
    expect(ids(applyFilters(list, f({ min: 850, max: 1000 })))).toEqual(["ars"]);
  });

  it("searches without accents, across club, player and number", () => {
    expect(ids(applyFilters(list, f({ q: "mbappe" })))).toEqual(["rma"]);
    expect(ids(applyFilters(list, f({ q: "#10 madrid" })))).toEqual(["rma"]);
    expect(ids(applyFilters(list, f({ q: "nobody" })))).toEqual([]);
  });

  it("only shows facets that can narrow the list", () => {
    const keys = facets(list, EMPTY_FILTERS).map((x) => x.key);
    expect(keys).toContain("club");
    expect(keys).toContain("size");
    expect(keys).not.toContain("country"); // one value only
    expect(keys).not.toContain("audience"); // everything is Men
    expect(keys).not.toContain("kit"); // no admin data yet
    expect(facets(list, EMPTY_FILTERS, ["club"]).map((x) => x.key)).not.toContain("club");
  });

  it("counts facet options against the other active filters", () => {
    const club = facets(list, f({ size: ["L"] })).find((x) => x.key === "club")!;
    expect(club.options.find((o) => o.value === "Arsenal")?.count).toBe(0);
    expect(club.options.find((o) => o.value === "Real Madrid")?.count).toBe(1);
  });

  it("hides the price filter when every price is the same", () => {
    expect(priceRange([list[0], product("x")])).toBeNull();
    expect(priceRange(list)).toEqual([800, 1200]);
  });

  it("round-trips through the URL and ignores junk", () => {
    const state = f({ q: "saka", club: ["Arsenal", "Real Madrid"], size: ["M"], min: 500, sort: "price-desc" });
    expect(parseFilters(serializeFilters(state))).toEqual(state);
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
    expect(parseFilters("?sort=evil&min=-5&max=abc")).toEqual(EMPTY_FILTERS);
  });
});

describe("club and player pages", () => {
  it("groups by stored values only, with stable slugs", () => {
    const clubs = groupBy(list, "club");
    expect(clubs.map((g) => g.slug)).toEqual(["argentina", "arsenal", "real-madrid"]);
    expect(groupBy(list, "player").map((g) => g.slug)).toEqual(["kylian-mbappe"]);
    expect(slugify("FC Barcelona")).toBe("fc-barcelona");
  });

  it("builds a placeholder when there are no players yet", () => {
    expect(staticParams([])).toEqual([{ slug: "_" }]);
  });
});

describe("productFromDb", () => {
  const row: DbProduct = {
    id: "u1",
    slug: "s",
    sku: null,
    name: "N",
    club: "C",
    country: null,
    player: null,
    number: 7,
    season: null,
    kit_type: "home",
    fit: null,
    audience: ["men"],
    description: null,
    story: "Body",
    story_title: null,
    video: null,
    price_paise: 100,
    featured: false,
    featured_position: null,
    product_images: [
      { storage_path: "products/s/2.webp", width: 10, height: 10, alt: "b", kind: "back", position: 1 },
      { storage_path: "products/s/1.webp", width: 10, height: 10, alt: "f", kind: "front", position: 0 },
    ],
    variants: [
      { size: "L", stock: 2, position: 1 },
      { size: "M", stock: 0, position: 0 },
    ],
  };

  it("maps front/back images to static media paths and orders variants", () => {
    const p = productFromDb(row);
    expect(p.image?.src).toBe("/media/products/s/1.webp");
    expect(p.backImage?.src).toBe("/media/products/s/2.webp");
    expect(p.images.map((i) => i.alt)).toEqual(["f", "b"]);
    expect(p.variants.map((v) => v.size)).toEqual(["M", "L"]);
    expect(p.story).toEqual({ title: null, body: "Body" });
    expect(p.kitType).toBe("home");
  });
});

describe("seo", () => {
  it("prices Product JSON-LD in rupees and marks sold out only when every size is 0", () => {
    const ld = productJsonLd(list[1]);
    expect(ld.offers.price).toBe("1200.00");
    expect(ld.offers.availability).toMatch(/InStock/);
    expect(productJsonLd(product("z", { variants: [{ size: "M", stock: 0 }] })).offers.availability).toMatch(/OutOfStock/);
  });

  it("escapes JSON-LD so it cannot close the script tag", () => {
    expect(jsonLd({ name: "</script><script>x" }).__html).not.toContain("</script>");
  });
});

describe("wishlist", () => {
  it("toggles, newest first, capped", () => {
    expect(wishlistOps.toggle(["a"], "b")).toEqual(["b", "a"]);
    expect(wishlistOps.toggle(["b", "a"], "b")).toEqual(["a"]);
    const full = Array.from({ length: MAX_WISHLIST }, (_, i) => `p${i}`);
    expect(wishlistOps.toggle(full, "new")).toHaveLength(MAX_WISHLIST);
  });
});
