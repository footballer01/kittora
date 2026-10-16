import { describe, expect, it } from "vitest";
import { countCategories, visibleCategories } from "@/lib/catalog/categories";
import { homeShowcase, MIN_PEG_RAIL } from "@/lib/catalog/peg-rail";
import type { CatalogProduct } from "@/lib/catalog/types";
import { cartOps, lineKey, MAX_QTY_PER_LINE, type CartLine } from "@/lib/stores/cart";

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
  image: { src: `/${id}.webp`, width: 600, height: 400, alt: id },
  backImage: null,
  images: [],
  story: null,
  video: null,
  variants: [],
  ...extra,
});

describe("categories", () => {
  it("hides categories with no products", () => {
    const counts = countCategories([product("a"), product("b")]);
    expect(visibleCategories(counts).map((c) => c.key)).toEqual(["men"]);
  });

  it("shows a category as soon as one product is in it", () => {
    const counts = countCategories([product("a"), product("k", { audience: ["kids"] })]);
    expect(visibleCategories(counts).map((c) => c.key)).toEqual(["men", "kids"]);
  });

  it("counts a product once per category", () => {
    expect(countCategories([product("a", { audience: ["men", "men", "women"] })])).toEqual({ men: 1, women: 1, kids: 0 });
  });
});

describe("homeShowcase", () => {
  it("falls back to the featured grid below the minimum", () => {
    const list = Array.from({ length: MIN_PEG_RAIL - 1 }, (_, i) => product(`n${i}`, { number: i + 1 }));
    expect(homeShowcase([...list, product("f", { featured: true, featuredPosition: 1 })]).kind).toBe("grid");
  });

  it("puts featured products first in the grid, in v1 order", () => {
    const show = homeShowcase([product("x"), product("b", { featured: true, featuredPosition: 2 }), product("a", { featured: true, featuredPosition: 1 })]);
    expect(show.products.map((p) => p.id)).toEqual(["a", "b", "x"]);
  });

  it("uses the rail once enough products have numbers, numbered ones only", () => {
    const numbered = Array.from({ length: MIN_PEG_RAIL }, (_, i) => product(`n${i}`, { number: i + 1 }));
    const show = homeShowcase([...numbered, product("plain")]);
    expect(show.kind).toBe("rail");
    expect(show.products).toHaveLength(MIN_PEG_RAIL);
  });

  it("ignores numbered products without an image", () => {
    const numbered = Array.from({ length: MIN_PEG_RAIL }, (_, i) => product(`n${i}`, { number: i + 1 }));
    numbered[0] = { ...numbered[0], image: null };
    expect(homeShowcase(numbered).kind).toBe("grid");
  });
});

describe("cart", () => {
  const line = (size: string, qty = 1): CartLine => ({ productId: "p", slug: "p", name: "P", size, qty, unitPricePaise: 90000, image: null });

  it("merges the same product and size", () => {
    const lines = cartOps.add(cartOps.add([], line("M")), line("M", 2));
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
  });

  it("keeps different sizes apart", () => {
    expect(cartOps.add(cartOps.add([], line("M")), line("L"))).toHaveLength(2);
  });

  it("caps quantity per line", () => {
    expect(cartOps.add([], line("M", 99))[0].qty).toBe(MAX_QTY_PER_LINE);
  });

  it("removes a line when quantity drops to zero", () => {
    const lines = cartOps.add([], line("M"));
    expect(cartOps.setQty(lines, lineKey(lines[0]), 0)).toEqual([]);
  });

  it("counts items and sums the display subtotal", () => {
    const lines = cartOps.add(cartOps.add([], line("M", 2)), line("L"));
    expect(cartOps.count(lines)).toBe(3);
    expect(cartOps.subtotalPaise(lines)).toBe(270000);
  });
});
