// Phase 0.5 — import v1 products, copy and assets. Read-only, polite crawl.
// Records exactly what v1 shows. Player, shirt number, season, kit type and
// fit are deliberately left empty: they are never parsed from names.
//
//   npx tsx scripts/import/crawl.ts
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  IMPORT_DIR,
  ORIGINALS_DIR,
  RAW_DIR,
  V1_ORIGIN,
  ensureDirs,
  fullResolution,
  launch,
  newPage,
  sleep,
  slugify,
  sniffImage,
  visit,
} from "./lib";

const LISTING_PAGES = [
  { path: "/", key: "home" },
  { path: "/category/all", key: "all" },
  { path: "/category/men", key: "men" },
  { path: "/category/women", key: "women" },
  { path: "/category/kids", key: "kids" },
] as const;
const AUDIENCES = ["men", "women", "kids"] as const;
const OTHER_PAGES = [
  { path: "/cart", key: "cart" },
  { path: "/orders", key: "orders" },
  { path: "/contact", key: "contact" },
] as const;
const EXPECTED_PRODUCTS = 13;

type Card = { v1Id: string; label: string; lines: string[] };

export type ImportedImage = {
  sourceUrl: string;
  fullResUrl: string;
  alt: string;
  file: string | null;
  bytes: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
};

export type ImportedProduct = {
  v1Id: string;
  v1Url: string;
  slug: string;
  name: string;
  club: string | null;
  clubLabel: string | null;
  country: string | null;
  countrySource: string | null;
  pricePaise: number | null;
  priceText: string | null;
  sku: string | null;
  audience: string[];
  listedOn: string[];
  featuredOnHome: boolean;
  homePosition: number | null;
  sizes: { label: string; disabled: boolean }[];
  stockText: string | null;
  description: string | null;
  /** Label/value pairs shown under the buy buttons (e.g. FIT, CATEGORY, CLUB). Raw, for reference. */
  v1Details: Record<string, string>;
  cardLabels: string[];
  images: ImportedImage[];
  pageTitle: string;
  metaDescription: string | null;
  // Intentionally empty — admins fill these in. Never inferred.
  player: null;
  number: null;
  season: null;
  kitType: null;
  fit: null;
};

async function readCards(page: Page): Promise<Card[]> {
  return page.$$eval('a[href^="/product/"]', (links) =>
    links.map((a) => {
      const lines = (a as HTMLElement).innerText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return { v1Id: a.getAttribute("href")!.split("/").pop()!, label: lines[0] ?? "", lines };
    }),
  );
}

async function pageMeta(page: Page) {
  return {
    title: await page.title(),
    description: await page.locator('meta[name="description"]').getAttribute("content").catch(() => null),
    og: await page.$$eval('meta[property^="og:"], meta[name^="twitter:"]', (ms) =>
      Object.fromEntries(ms.map((m) => [m.getAttribute("property") ?? m.getAttribute("name"), m.getAttribute("content")])),
    ),
    icons: await page.$$eval('link[rel*="icon"]', (ls) => ls.map((l) => (l as HTMLLinkElement).href)),
  };
}

async function saveRaw(page: Page, key: string) {
  writeFileSync(join(RAW_DIR, `${key}.html`), await page.content());
  writeFileSync(join(RAW_DIR, `${key}.txt`), await page.innerText("body"));
}

async function readProduct(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1")!;
    const column = h1.parentElement!;
    const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim() || null;

    const clubEl = h1.previousElementSibling;
    const priceEl = [...column.querySelectorAll("span")].find((s) => s.textContent?.includes("₹"));
    const skuEl = priceEl?.nextElementSibling;
    const stockEl = priceEl?.parentElement?.nextElementSibling;
    const descEl = [...column.querySelectorAll(":scope > p")].find((p) => p !== clubEl && (p.textContent ?? "").length > 40);

    const sizeHeading = [...column.querySelectorAll("p")].find((p) => p.textContent?.trim() === "Select size");
    const sizes = sizeHeading
      ? [...(sizeHeading.nextElementSibling?.querySelectorAll("button") ?? [])].map((b) => ({
          label: (b.textContent ?? "").trim(),
          disabled: b.disabled || b.getAttribute("aria-disabled") === "true" || /line-through|opacity-40|cursor-not-allowed/.test(b.className),
        }))
      : [];

    // Detail pairs after the buy buttons: uppercase label, then value.
    const lines = (column as HTMLElement).innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    const after = lines.slice(lines.findIndex((l) => /^buy now$/i.test(l)) + 1);
    const details: Record<string, string> = {};
    for (let i = 0; i + 1 < after.length; i += 2) details[after[i]] = after[i + 1];

    const images = [...document.querySelectorAll("img")]
      .filter((img) => {
        const src = img.currentSrc || img.src;
        return src && !src.startsWith("data:") && !src.includes("builder-assets") && !img.closest("footer, header, nav");
      })
      .map((img) => ({ src: img.currentSrc || img.src, alt: img.alt }));

    return {
      name: text(h1)!,
      club: text(clubEl),
      priceText: text(priceEl),
      sku: text(skuEl),
      stockText: text(stockEl),
      description: text(descEl),
      sizes,
      details,
      images,
    };
  });
}

async function readHomeCopy(page: Page) {
  return page.evaluate(() => {
    const t = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim() || null;
    const lines = (el: Element | null) => (el ? (el as HTMLElement).innerText.split("\n").map((s) => s.trim()).filter(Boolean) : []);
    const sections = [...document.querySelectorAll("section")];
    const hero = sections[0];
    const h1 = hero?.querySelector("h1");
    const heroText = lines(hero);
    const heroButtons = [...(hero?.querySelectorAll("a, button") ?? [])].map((a) => ({ text: t(a), href: a.getAttribute("href") }));
    const tiles = [...document.querySelectorAll("h3")]
      .filter((h) => ["Men", "Women", "Kids"].includes(t(h) ?? ""))
      .map((h) => {
        const card = h.closest("a") ?? h.parentElement?.parentElement;
        return { lines: lines(card ?? null), href: card?.getAttribute("href") ?? null };
      });
    const featured = [...document.querySelectorAll("h2")].map((h) => ({
      heading: t(h),
      sectionLines: lines(h.closest("section")).slice(0, 4),
    }));
    const footer = document.querySelector("footer");
    const footerLinks = [...(footer?.querySelectorAll("a") ?? [])].map((a) => ({ text: t(a), href: a.getAttribute("href") }));
    const trustSection = sections.find((s) => /authentic|deliver|return/i.test(s.textContent ?? "") && !s.querySelector("h1"));
    return {
      heroLines: heroText,
      heroHeading: (h1 as HTMLElement | null)?.innerText.replace(/\n/g, " ").trim() ?? null,
      heroButtons,
      tiles,
      featured,
      trustLines: lines(trustSection ?? null),
      footerLines: lines(footer),
      footerLinks,
      headerLinks: [...document.querySelectorAll("header a, nav a")].map((a) => ({ text: t(a), href: a.getAttribute("href") })),
      heroImage: (hero?.querySelector("img") as HTMLImageElement | null)?.currentSrc ?? null,
      heroImageAlt: (hero?.querySelector("img") as HTMLImageElement | null)?.alt ?? null,
      logoMark: t(document.querySelector("header")?.querySelector("span, div")),
    };
  });
}

const redact = (s: string) =>
  s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s-]{8,}\d|\+91 X+ X+/g, "[phone]");

function linesAfter(lines: string[], marker: string, count: number): string[] {
  const i = lines.indexOf(marker);
  return i < 0 ? [] : lines.slice(i + 1, i + 1 + count);
}

/** Structured, public-safe copy. Contact details are redacted (they live in raw/ only). */
function buildCopy(home: NonNullable<Awaited<ReturnType<typeof readHomeCopy>>>, other: Record<string, string>, categoryText: string) {
  const heroLines = home.heroLines;
  const headingIdx = heroLines.findIndex((l) => home.heroHeading?.startsWith(l));
  const footer = home.footerLines;
  const column = (title: string) => {
    const start = footer.indexOf(title);
    const out: string[] = [];
    for (let i = start + 1; start >= 0 && i < footer.length && !/^[A-Z]{3,}$/.test(footer[i]) && !footer[i].startsWith("©"); i++) out.push(footer[i]);
    return out;
  };
  const trust: { title: string; body: string }[] = [];
  for (let i = 0; i + 1 < home.trustLines.length; i += 2) trust.push({ title: home.trustLines[i], body: home.trustLines[i + 1] });
  const textLines = (t: string | undefined) => (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const contact = textLines(other.contact);
  const contactStart = contact.indexOf("Help / Contact");
  return {
    header: {
      logo: { mark: "K", wordmark: "KITTORA" },
      nav: home.headerLinks.filter((l) => l.text && l.text !== "KKITTORA"),
      iconLinks: home.headerLinks.filter((l) => !l.text).map((l) => l.href),
    },
    hero: {
      eyebrow: headingIdx > 0 ? heroLines[0] : null,
      heading: home.heroHeading,
      subline: heroLines.find((l) => l.length > 60) ?? null,
      buttons: home.heroButtons,
      imageAlt: home.heroImageAlt || null,
    },
    categoryTiles: home.tiles.map((t) => ({ name: t.lines[0], tagline: t.lines[1] ?? null, cta: t.lines[2] ?? null, href: t.href })),
    featured: {
      eyebrow: home.featured[0]?.sectionLines[0] ?? null,
      heading: home.featured[0]?.heading ?? null,
      cta: home.featured[0]?.sectionLines[2] ?? null,
    },
    trustPoints: trust,
    footer: {
      tagline: footer.find((l) => l.length > 60) ?? null,
      columns: { Shop: column("SHOP"), Support: column("SUPPORT"), Contact: column("CONTACT").map(redact) },
      links: home.footerLinks.map((l) => ({ text: l.text ? redact(l.text) : null, href: l.href?.startsWith("mailto:") ? "mailto:[email]" : l.href })),
      copyright: footer.find((l) => l.startsWith("©")) ?? null,
      paymentLine: footer.find((l) => /payments/i.test(l)) ?? null,
    },
    emptyStates: {
      category: linesAfter(textLines(categoryText), "Price: High to Low", 2),
      cart: linesAfter(textLines(other.cart), "All Jerseys", 3),
      orders: linesAfter(textLines(other.orders), "All Jerseys", 3),
    },
    productPage: { backLink: "Back to catalogue", sizeLabel: "Select size", quantityLabel: "Quantity", buttons: ["Add to Cart", "Buy Now"] },
    contactPage: {
      eyebrow: contactStart > 0 ? contact[contactStart - 1] : null,
      heading: contactStart >= 0 ? contact[contactStart] : null,
      intro: contactStart >= 0 ? contact[contactStart + 1] : null,
      hours: linesAfter(contact, "Hours", 1)[0] ?? null,
      formHeading: contact.find((l) => l === "Send a message") ?? null,
    },
  };
}

function paiseFrom(priceText: string | null): number | null {
  const digits = priceText?.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const seenDownloads = new Map<string, Omit<ImportedImage, "sourceUrl" | "alt">>();

async function download(url: string, baseName: string): Promise<Omit<ImportedImage, "sourceUrl" | "alt">> {
  const fullResUrl = fullResolution(url);
  const cached = seenDownloads.get(fullResUrl);
  if (cached) return cached;
  let result: Omit<ImportedImage, "sourceUrl" | "alt">;
  try {
    await sleep(400);
    const res = await fetch(fullResUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type");
    if (!contentType?.startsWith("image/")) throw new Error(`not an image (${contentType})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const sniffed = sniffImage(buf);
    if (!sniffed) throw new Error("unreadable image data");
    // Name by the real bytes: v1 serves some JPEGs under .png URLs.
    const ext = sniffed.type === "jpeg" ? ".jpg" : `.${sniffed.type}`;
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const file = `${baseName}-${hash}${ext}`;
    writeFileSync(join(ORIGINALS_DIR, file), buf);
    result = {
      fullResUrl,
      file,
      bytes: buf.length,
      contentType: `image/${sniffed.type}`,
      width: sniffed.width,
      height: sniffed.height,
      error: null,
    };
  } catch (err) {
    result = { fullResUrl, file: null, bytes: null, contentType: null, width: null, height: null, error: (err as Error).message };
  }
  seenDownloads.set(fullResUrl, result);
  return result;
}

async function main() {
  ensureDirs();
  const browser = await launch();
  const page = await newPage(browser, { width: 1440, height: 900 });
  const failures: string[] = [];

  // 1. Listing pages → product ids and where each is listed.
  const listings: Record<string, Card[]> = {};
  const pageMetas: Record<string, Awaited<ReturnType<typeof pageMeta>>> = {};
  let homeCopy: Awaited<ReturnType<typeof readHomeCopy>> | null = null;
  for (const { path, key } of LISTING_PAGES) {
    console.log(`→ ${path}`);
    await visit(page, path);
    listings[key] = await readCards(page);
    pageMetas[key] = await pageMeta(page);
    await saveRaw(page, key === "home" ? "home" : `category-${key}`);
    if (key === "home") homeCopy = await readHomeCopy(page);
    console.log(`  ${listings[key].length} product links`);
  }

  const ids = [...new Set(Object.values(listings).flat().map((c) => c.v1Id))];
  console.log(`\n${ids.length} unique products (expected ${EXPECTED_PRODUCTS})`);

  // 2. Product pages.
  const products: ImportedProduct[] = [];
  for (const [i, v1Id] of ids.entries()) {
    const path = `/product/${v1Id}`;
    console.log(`→ [${i + 1}/${ids.length}] ${path}`);
    try {
      await visit(page, path);
    } catch (err) {
      failures.push(`product ${v1Id}: ${(err as Error).message}`);
      continue;
    }
    await saveRaw(page, `product-${v1Id}`);
    const data = await readProduct(page);
    const meta = await pageMeta(page);
    const listedOn = LISTING_PAGES.filter(({ key }) => listings[key].some((c) => c.v1Id === v1Id)).map((l) => l.key);
    const cardLabels = [...new Set(Object.values(listings).flat().filter((c) => c.v1Id === v1Id).map((c) => c.label))];
    const labelCountry = cardLabels.map((l) => l.split(" · ")[1]).find(Boolean);
    const detailCountry = Object.entries(data.details).find(([k]) => /^country$/i.test(k))?.[1];
    const slug = slugify(data.name);
    const homeIdx = listings.home.findIndex((c) => c.v1Id === v1Id);

    const images: ImportedImage[] = [];
    for (const [n, img] of data.images.entries()) {
      const d = await download(img.src, `${slug}-${n + 1}`);
      if (d.error) failures.push(`image for ${v1Id}: ${d.error} (${d.fullResUrl})`);
      images.push({ sourceUrl: img.src, alt: img.alt, ...d });
    }

    products.push({
      v1Id,
      v1Url: V1_ORIGIN + path,
      slug,
      name: data.name,
      // The labelled CLUB detail is the plain club name; the heading label can
      // be "Club · Country" (e.g. Argentina), so it is kept in clubLabel.
      club: data.details.CLUB ?? data.club,
      clubLabel: data.club,
      country: detailCountry ?? labelCountry ?? null,
      countrySource: detailCountry ? "product page detail" : labelCountry ? "listing card label (club · country)" : null,
      pricePaise: paiseFrom(data.priceText),
      priceText: data.priceText,
      sku: data.sku,
      audience: AUDIENCES.filter((a) => listedOn.includes(a)),
      listedOn,
      featuredOnHome: homeIdx >= 0,
      homePosition: homeIdx >= 0 ? homeIdx + 1 : null,
      sizes: data.sizes,
      stockText: data.stockText,
      description: data.description,
      v1Details: data.details,
      cardLabels,
      images,
      pageTitle: meta.title,
      metaDescription: meta.description,
      player: null,
      number: null,
      season: null,
      kitType: null,
      fit: null,
    });
  }

  // 3. Other pages: raw text for copy and contact details (contact stays private).
  const otherText: Record<string, string> = {};
  for (const { path, key } of OTHER_PAGES) {
    console.log(`→ ${path}`);
    try {
      await visit(page, path);
      await saveRaw(page, key);
      pageMetas[key] = await pageMeta(page);
      otherText[key] = await page.innerText("body");
    } catch (err) {
      failures.push(`${path}: ${(err as Error).message}`);
    }
  }
  const contactDetails = await page.evaluate(() => ({
    mailto: [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute("href")),
    tel: [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href")),
    whatsapp: [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]')].map((a) => a.getAttribute("href")),
  }));
  await browser.close();

  // 4. Site assets: hero, logo/favicon, OG image.
  const homeMeta = pageMetas.home;
  const assets: Record<string, ImportedImage> = {};
  const assetSources: [string, string | null | undefined, string][] = [
    ["hero", homeCopy?.heroImage, homeCopy?.heroImageAlt ?? ""],
    ["favicon", homeMeta.icons[0], "favicon"],
    ["og-image", homeMeta.og["og:image"], "OG image"],
  ];
  for (const [name, url, alt] of assetSources) {
    if (!url) {
      failures.push(`asset ${name}: not found on page`);
      continue;
    }
    const d = await download(url, name);
    if (d.error) failures.push(`asset ${name}: ${d.error}`);
    assets[name] = { sourceUrl: url, alt, ...d };
  }

  // 5. Sanity checks.
  const warnings: string[] = [];
  if (ids.length !== EXPECTED_PRODUCTS) warnings.push(`Found ${ids.length} products, expected ${EXPECTED_PRODUCTS}.`);
  const skuCounts = new Map<string, number>();
  for (const p of products) if (p.sku) skuCounts.set(p.sku, (skuCounts.get(p.sku) ?? 0) + 1);
  for (const [sku, n] of skuCounts) if (n > 1) warnings.push(`Duplicate SKU ${sku} (${n} products).`);
  for (const p of products) {
    if (!p.sku) warnings.push(`${p.v1Id} has no SKU.`);
    if (p.pricePaise == null) warnings.push(`${p.v1Id} has no price.`);
    if (p.audience.length === 0) warnings.push(`${p.name} is not listed in Men, Women or Kids.`);
    if (!p.club) warnings.push(`${p.name} has no club.`);
    if (p.images.some((i) => i.width != null && i.width < 1000)) warnings.push(`${p.name}: image is only ${p.images[0].width}×${p.images[0].height}px.`);
    if (!p.listedOn.includes("all")) warnings.push(`${p.name} is not listed in All Jerseys.`);
    if (p.images.length === 0) warnings.push(`${p.name} has no images.`);
    if (p.images.some((i) => i.error)) warnings.push(`${p.name} has a broken image.`);
    if (p.sizes.length === 0) warnings.push(`${p.name} shows no sizes.`);
    if (!p.description) warnings.push(`${p.name} has no description.`);
  }
  const slugCounts = new Map<string, number>();
  for (const p of products) slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
  for (const [slug, n] of slugCounts) if (n > 1) warnings.push(`Slug collision: ${slug} (${n}).`);

  // 6. Write outputs.
  const crawledAt = new Date().toISOString();
  writeFileSync(join(IMPORT_DIR, "products.json"), JSON.stringify({ source: V1_ORIGIN, crawledAt, products, assets }, null, 2) + "\n");
  writeFileSync(
    join(IMPORT_DIR, "redirects.json"),
    JSON.stringify(
      Object.fromEntries(products.map((p) => [p.v1Id, { from: `/product/${p.v1Id}`, slug: p.slug }])),
      null,
      2,
    ) + "\n",
  );
  const categoryEmptyText = (() => {
    try {
      return readFileSync(join(RAW_DIR, "category-kids.txt"), "utf8");
    } catch {
      return "";
    }
  })();
  writeFileSync(
    join(IMPORT_DIR, "copy.json"),
    JSON.stringify(
      {
        source: V1_ORIGIN,
        crawledAt,
        copy: homeCopy ? buildCopy(homeCopy, otherText, categoryEmptyText) : null,
        pageMeta: Object.fromEntries(
          Object.entries(pageMetas).map(([k, m]) => [k, { title: m.title, description: m.description, og: m.og }]),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  // Private (gitignored): contact details are for the report only.
  writeFileSync(join(RAW_DIR, "contact-details.json"), JSON.stringify(contactDetails, null, 2) + "\n");

  const counts = {
    unique: ids.length,
    perListing: Object.fromEntries(Object.entries(listings).map(([k, v]) => [k, new Set(v.map((c) => c.v1Id)).size])),
    perAudience: Object.fromEntries(AUDIENCES.map((a) => [a, products.filter((p) => p.audience.includes(a)).length])),
    imagesDownloaded: [...seenDownloads.values()].filter((d) => d.file).length,
    imagesFailed: [...seenDownloads.values()].filter((d) => d.error).length,
  };
  const summary = { crawledAt, counts, warnings, failures };
  writeFileSync(join(RAW_DIR, "crawl-summary.json"), JSON.stringify(summary, null, 2) + "\n");

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(counts, null, 2));
  console.log(warnings.length ? `Warnings:\n- ${warnings.join("\n- ")}` : "No warnings.");
  console.log(failures.length ? `Failures:\n- ${failures.join("\n- ")}` : "No failures.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
