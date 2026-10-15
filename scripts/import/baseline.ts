// Phase 0.5 — v1 baseline: Lighthouse (mobile), axe, and a written design
// audit, so v2 can be measured against it. Read-only.
//
//   npx tsx scripts/import/baseline.ts
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { IMPORT_DIR, V1_ORIGIN, VIEWPORTS, launch, newPage, visit } from "./lib";

const LH_DIR = join(IMPORT_DIR, "lighthouse");
const products = JSON.parse(readFileSync(join(IMPORT_DIR, "products.json"), "utf8")).products as { v1Id: string }[];

const PAGES = [
  { key: "home", path: "/" },
  { key: "category", path: "/category/all" },
  { key: "product", path: `/product/${products[0].v1Id}` },
] as const;

/**
 * Written observations of v1, each pointing at a screenshot in screenshots/.
 * Kept here (not generated) so the audit is reviewable in code.
 */
const DESIGN_AUDIT = [
  {
    area: "Product imagery",
    severity: "high",
    observation:
      "Every product photo is a ~600×380 landscape shot (front and back side by side) shown in a 4:5 portrait frame with object-cover, so both shirts are cropped at the edges and upscaled ~2× on retina screens.",
    screenshots: ["product-1440.png", "home-1440.png", "category-390.png"],
  },
  {
    area: "Contrast",
    severity: "high",
    observation:
      "The secondary hero button (“Explore Men”) is white text on a translucent white pill over the hero photo — it reads as a disabled grey button and fails AA. Tiny 10px uppercase mono labels (club name on cards) sit at 40% opacity on near-black.",
    screenshots: ["home-1440.png", "home-390.png"],
  },
  {
    area: "Theme consistency",
    severity: "medium",
    observation:
      "The site is dark everywhere except a light footer, which reads as a different site bolted on. The CSS variables are a light theme with names swapped (`--sand` is near-black, `--graphite` is near-white), so colour names in code are misleading.",
    screenshots: ["home-1440.png", "product-1440.png"],
  },
  {
    area: "Hierarchy",
    severity: "medium",
    observation:
      "Category tiles are three identical empty dark gradient panels with no imagery; on mobile they take a full screen before any product appears. Women and Kids tiles lead to empty pages (“No jerseys found.”).",
    screenshots: ["home-390.png", "home-1440.png"],
  },
  {
    area: "Mobile layout",
    severity: "medium",
    observation:
      "On 390px product cards the SKU wraps into the price line (“₹900 KTR-RMA-GRN-” / “MBP10”); names truncate with ellipses (“Arsenal Red & White Saka #7…”). The hero subline sits directly on a busy photo.",
    screenshots: ["home-390.png", "category-390.png"],
  },
  {
    area: "Product page",
    severity: "medium",
    observation:
      "One image, no gallery or zoom. Detail block repeats “Fit: Men” and “Category: Men”. No size guide, delivery estimate or related products. Quantity stepper buttons have no accessible names.",
    screenshots: ["product-1440.png", "product-390.png"],
  },
  {
    area: "Radius and spacing",
    severity: "low",
    observation:
      "Radius varies by component: 16px cards, fully round pills for buttons and sizes, 12px inputs. Section spacing is consistent (80px) but the trust strip and footer use different horizontal rhythm from the content above.",
    screenshots: ["home-1440.png"],
  },
  {
    area: "Missing states",
    severity: "medium",
    observation:
      "No visible keyboard focus style on nav links, cards or size buttons beyond the browser default; hover only changes text colour to coral. Empty states exist (cart, orders, category) but offer no next step beyond one link. No error states seen.",
    screenshots: ["cart-1440.png", "category-1440.png"],
  },
  {
    area: "Dead and placeholder links",
    severity: "high",
    observation:
      "“Returns” and “Size Guide” in the footer both go to /contact. Footer phone is the literal placeholder “+91 XXXXX XXXXX” (the contact page shows a real number). Instagram, Twitter and Facebook icons link to the bare platform home pages. Header icon links (orders, cart, contact) have no text labels.",
    screenshots: ["home-1440.png", "contact-1440.png"],
  },
  {
    area: "Platform chrome",
    severity: "low",
    observation:
      "A floating “Edit with Base44” badge overlaps product content and the category tiles on every page.",
    screenshots: ["product-1440.png", "home-390.png"],
  },
  {
    area: "Payment and trust copy",
    severity: "low",
    observation:
      "Footer says “Secured payments via Razorpay · UPI · Cards · Net Banking”; v2 uses UPI only, so this line must change. Trust points promise “Authenticated Craft” and “Seven-day hassle-free returns” but there is no returns page to back them.",
    screenshots: ["home-1440.png"],
  },
];

function runLighthouse(chromePath: string): Record<string, unknown>[] {
  const args = PAGES.map(({ key, path }) => `${key}=${V1_ORIGIN}${path}`);
  const out = execFileSync("node", [join(IMPORT_DIR, "lighthouse-run.mjs"), chromePath, LH_DIR, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(out);
}

async function runAxe() {
  const browser = await launch();
  const results: Record<string, unknown>[] = [];
  for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
    const page = await newPage(browser, vp);
    for (const { key, path } of PAGES) {
      console.log(`→ axe ${vpKey} ${path}`);
      await visit(page, path);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      results.push({
        page: key,
        viewport: vpKey,
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          count: v.nodes.length,
          examples: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary ?? "").split("\n").slice(0, 3).join(" ") })),
        })),
      });
    }
    await page.close();
  }
  await browser.close();
  return results;
}

async function main() {
  mkdirSync(LH_DIR, { recursive: true });
  const lighthouseResults = runLighthouse(chromium.executablePath());
  const axeResults = await runAxe();
  const baseline = {
    source: V1_ORIGIN,
    measuredAt: new Date().toISOString(),
    notes: [
      "Lighthouse uses its default mobile emulation (Moto G Power, simulated slow 4G) via Chrome for Testing. Each page is run 3 times; the median-performance run is reported, with the range.",
      "axe runs WCAG 2.0/2.1/2.2 A and AA rules plus best practices, at 390px and 1440px.",
    ],
    lighthouse: lighthouseResults,
    axe: axeResults,
    designAudit: DESIGN_AUDIT,
  };
  writeFileSync(join(IMPORT_DIR, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
  for (const r of lighthouseResults as { page: string; scores: object; metrics: object; weight: object }[]) {
    console.log(r.page, JSON.stringify(r.scores), JSON.stringify(r.metrics), JSON.stringify(r.weight));
  }
  for (const r of axeResults as { page: string; viewport: string; violations: { id: string; impact: string; count: number }[] }[]) {
    console.log(`axe ${r.page}@${r.viewport}: ${r.violations.map((v) => `${v.id}(${v.impact},${v.count})`).join(", ") || "none"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
