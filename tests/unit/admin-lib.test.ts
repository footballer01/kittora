import { describe, expect, it } from "vitest";
import { missingDetails, needsDetails } from "@/lib/admin/needs-details";
import { actionsFor } from "@/lib/admin/order-flow";
import { parseStock, productSchema, slugify } from "@/lib/admin/product-form";
import { parseZonesCsv, zonesToCsv } from "@/lib/admin/zones-csv";

const product = {
  club: "Arsenal",
  country: null,
  season: "2024/25",
  kit_type: "home",
  fit: "Fan",
  description: "Red body, white sleeves.",
  audience: ["men"],
  player: null,
  number: null,
  product_images: [{ kind: "front" }, { kind: "back" }],
};

describe("needs details", () => {
  it("flags empty required fields and only highlights player and number", () => {
    expect(missingDetails(product)).toEqual({ required: [], optional: ["player", "number"] });
    expect(needsDetails(product)).toBe(false);
    const imported = { ...product, season: null, kit_type: null, fit: " ", product_images: [{ kind: "other" }] };
    expect(missingDetails(imported).required).toEqual(["season", "kit_type", "fit", "back_image"]);
    expect(needsDetails(imported)).toBe(true);
  });
});

describe("order actions", () => {
  it("offers the next steps only", () => {
    expect(actionsFor("payment_submitted")).toEqual(["paid", "cancelled"]);
    expect(actionsFor("shipped")).toEqual(["delivered"]);
    expect(actionsFor("cancelled")).toEqual([]);
  });
});

describe("product form", () => {
  const base = {
    name: "Arsenal Home",
    slug: "arsenal-home",
    club: "",
    country: "",
    player: "",
    number: "",
    season: "",
    kit_type: "",
    fit: "",
    audience: [],
    price: "1499",
    description: "",
    story_title: "",
    story: "",
    published: true,
    featured: false,
    featured_position: "",
    track_stock: false,
  } as const;

  it("turns rupees into paise and empty fields into null", () => {
    const v = productSchema.parse({ ...base, price: "1499.50", number: "7" });
    expect(v).toMatchObject({ price: 149950, number: 7, club: null, kit_type: null });
  });

  it("rejects bad prices, numbers and slugs", () => {
    expect(productSchema.safeParse({ ...base, price: "-5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, number: "100" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
  });

  it("slugifies names", () => {
    expect(slugify("Barcelona Messi #10 Jersey — Qatar Airways")).toBe("barcelona-messi-10-jersey-qatar-airways");
  });

  it("parses stock boxes", () => {
    expect([parseStock(""), parseStock("4"), parseStock("-1"), parseStock("2.5")]).toEqual([null, 4, "invalid", "invalid"]);
  });
});

describe("zones CSV", () => {
  it("parses rows, skips the header and reports bad lines", () => {
    const { rows, errors } = parseZonesCsv('name,prefix,min,max,cod\n"Pune, city",411,1,2,yes\nMaharashtra,4,2,4,\nBad,4x,1,2,no\nDup,411,1,2,no\n');
    expect(rows).toEqual([
      { name: "Pune, city", pincode_prefix: "411", min_days: 1, max_days: 2, cod_available: true },
      { name: "Maharashtra", pincode_prefix: "4", min_days: 2, max_days: 4, cod_available: false },
    ]);
    expect(errors).toEqual(["Line 4: pincode prefix must be 1–6 digits", "Line 5: prefix 411 appears twice"]);
  });

  it("round-trips through export", () => {
    const rows = [{ name: 'A "B", C', pincode_prefix: "56", min_days: 3, max_days: 5, cod_available: true }];
    expect(parseZonesCsv(zonesToCsv(rows)).rows).toEqual(rows);
  });
});
