// Phase 0.5 — build scripts/import/report.html from the import outputs.
// The report is local only (gitignored): it shows v1's contact details.
//
//   npx tsx scripts/import/report.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IMPORT_DIR, RAW_DIR } from "./lib";

const read = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Product = {
  v1Id: string;
  v1Url: string;
  slug: string;
  name: string;
  club: string | null;
  country: string | null;
  priceText: string | null;
  pricePaise: number | null;
  sku: string | null;
  audience: string[];
  sizes: { label: string; disabled: boolean }[];
  stockText: string | null;
  description: string | null;
  images: { file: string | null; width: number | null; height: number | null; alt: string }[];
  v1Details: Record<string, string>;
  featuredOnHome: boolean;
  homePosition: number | null;
};
type Token = { value: string; oklch: string; source: string; usage: string; changedFromV1?: { from: string; reason: string } };
type Check = { theme: string; pair: string; fg: string; bg: string; ratio: number; required: number; kind: string; pass: boolean; fix?: { proposal: string } };

const products = read<{ products: Product[]; assets: Record<string, { file: string | null; width: number | null; height: number | null }> }>(
  join(IMPORT_DIR, "products.json"),
)!;
const copy = read<{ copy: Record<string, unknown> }>(join(IMPORT_DIR, "copy.json"));
const theme = read<{
  palette: { hex: string; count: number; props: Record<string, number>; examples: string[] }[];
  samples: { page: string; viewport: string; role: string; state: string; selector: string; styles: Record<string, string> }[];
  fonts: { loadedFaces: { family: string; weight: string }[]; fontFiles: string[] };
  darkMode: { present: boolean; bodyBackgroundLight: string; bodyBackgroundWhenOsDark: string };
  screenshots: { page: string; viewport: string; file: string }[];
}>(join(IMPORT_DIR, "theme.json"));
const tokens = read<{
  finding: string;
  v1Colours: Record<string, string>;
  themes: { dark: Record<string, Token>; light: Record<string, Token> };
  contrast: { checks: Check[]; v1AsShipped: { label: string; fg: string; bg: string; ratio: number; required: number; pass: boolean }[] };
  decisionsNeeded: { id: string; question: string; options: { label: string; detail: string }[]; recommendation: string; applied?: string }[];
  typeScale: {
    base: number;
    ratio: number;
    steps: Record<string, { px: number; use: string }>;
    families: Record<string, { family: string; weights: number[]; source: string }>;
    casing: string;
  };
  v1Type: Record<string, { family: string; weight: string; sizeDesktop: string; sizeMobile: string | null; lineHeight: string; letterSpacing: string; transform: string; selector: string; page: string } | null>;
  shape: Record<string, unknown>;
}>(join(IMPORT_DIR, "tokens.proposal.json"));
const baseline = read<{
  notes: string[];
  lighthouse: {
    page: string;
    url: string;
    runs?: number;
    performanceRange?: number[];
    scores: Record<string, number>;
    metrics: Record<string, number>;
    weight: Record<string, number>;
    error?: string;
  }[];
  axe: { page: string; viewport: string; violations: { id: string; impact: string; help: string; count: number; helpUrl: string; examples: { target: string }[] }[] }[];
  designAudit: { area: string; severity: string; observation: string; screenshots: string[] }[];
}>(join(IMPORT_DIR, "baseline.json"));
const crawl = read<{ counts: Record<string, unknown>; warnings: string[]; failures: string[] }>(join(RAW_DIR, "crawl-summary.json"));
const contact = read<{ mailto: string[]; tel: string[]; whatsapp: string[] }>(join(RAW_DIR, "contact-details.json"));
const manifest = read<{ original: string; webp: string; bytes: number; width: number; height: number }[]>(join(IMPORT_DIR, "images/webp/manifest.json")) ?? [];
const webpFor = (file: string | null) => manifest.find((m) => m.original === file);

const dark = tokens!.themes.dark;
const light = tokens!.themes.light;
const cssVars = (t: Record<string, Token>) =>
  Object.entries(t)
    .map(([k, v]) => `${k}:${v.value};`)
    .join("");

// ------------------------------------------------------------------ sections
function summary() {
  const c = crawl?.counts as { unique: number; perListing: Record<string, number>; imagesDownloaded: number; imagesFailed: number } | undefined;
  const lowRes = products.products.filter((p) => p.images.some((i) => (i.width ?? 0) < 1000)).length;
  const skipped = [
    "Seed (step 7): blocked — no .env.local yet. Exact list of what to create and paste is at the end of this report.",
    "Cart page captured in its empty state only: adding to cart was not done, to avoid changing anything on v1.",
    "Hover/focus styles were captured by hovering and focusing; pressed (active) states were not triggered.",
  ];
  return `
  <section id="summary">
    <h2>Summary</h2>
    <div class="stats">
      <div><b>${c?.unique ?? "?"}</b><span>products (expected 13)</span></div>
      <div><b>${c?.perListing.men ?? 0}</b><span>in Men</span></div>
      <div><b>${c?.perListing.women ?? 0}</b><span>in Women</span></div>
      <div><b>${c?.perListing.kids ?? 0}</b><span>in Kids</span></div>
      <div><b>${c?.perListing.home ?? 0}</b><span>featured on home</span></div>
      <div><b>${c?.imagesDownloaded ?? 0}</b><span>images downloaded, ${c?.imagesFailed ?? 0} failed</span></div>
      <div><b>${manifest.length}</b><span>WebP copies, all &lt; 250 KB</span></div>
      <div><b>${theme?.screenshots.length ?? 0}</b><span>screenshots</span></div>
    </div>
    <h3>Key findings</h3>
    <ul>
      <li><b>v1 is a dark theme</b> (near-black page, coral primary, sky accent) with a light footer. Dark stays the default; a light variant is proposed from v1's own footer colours.</li>
      <li><b>Women and Kids are empty on v1</b> (“No jerseys found.”). All 13 jerseys are listed under Men and All Jerseys; every product page says “Fit: Men”.</li>
      <li><b>All ${lowRes} product photos are ~600×380 landscape</b> (front and back side by side) — the largest Base44 stores. v1 crops them into a 4:5 frame. New photography is needed for the gallery and peg rail.</li>
      <li><b>Stock is not numeric on v1</b> — every product says “In stock” with all five sizes. Stock counts are left empty for admins.</li>
      <li><b>Every price is ₹900</b>; every product has a unique SKU; no product is missing a price, category or image.</li>
      <li><b>White text on the coral button fails WCAG AA</b> (2.69:1). Proposal keeps coral and uses near-black text (7.4:1) — decision needed below.</li>
    </ul>
    <h3>Warnings from the crawl</h3>
    <ul>${(crawl?.warnings ?? []).map((w) => `<li>${esc(w)}</li>`).join("") || "<li>None</li>"}</ul>
    <h3>Failures</h3>
    <ul>${(crawl?.failures ?? []).map((w) => `<li>${esc(w)}</li>`).join("") || "<li>None</li>"}</ul>
    <h3>Skipped or partial</h3>
    <ul>${skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  </section>`;
}

function swatch(hex: string, label: string, sub = "") {
  return `<figure class="sw"><div class="chip" style="background:${esc(hex)}"></div><figcaption><b>${esc(label)}</b><code>${esc(hex)}</code>${sub}</figcaption></figure>`;
}

function colours() {
  const v1 = Object.entries(tokens!.v1Colours)
    .map(([k, hex]) => swatch(hex, `--${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`))
    .join("");
  const palette = (theme?.palette ?? [])
    .slice(0, 24)
    .map((c) =>
      swatch(
        c.hex,
        `${c.count}× used`,
        `<small>${esc(
          Object.entries(c.props)
            .map(([k, n]) => `${k} ${n}`)
            .join(", "),
        )}</small><small class="mono">${esc(c.examples[0] ?? "")}</small>`,
      ),
    )
    .join("");
  const tokenRows = Object.keys(dark)
    .map((k) => {
      const d = dark[k];
      const l = light[k];
      const changed = d.changedFromV1 ?? l?.changedFromV1;
      return `<tr>
        <td><code>${esc(k)}</code>${changed ? `<span class="pill warn">changed from v1</span>` : ""}</td>
        <td><span class="dot" style="background:${esc(d.value)}"></span><code>${esc(d.value)}</code><small>${esc(d.oklch)}</small></td>
        <td><span class="dot" style="background:${esc(l?.value)}"></span><code>${esc(l?.value)}</code><small>${esc(l?.oklch)}</small></td>
        <td>${esc(d.usage)}</td>
        <td><small>${esc(d.source)}${changed ? `<br><b>Why changed:</b> ${esc(changed.reason)} (was ${esc(changed.from)})` : ""}</small></td>
      </tr>`;
    })
    .join("");
  const checkRows = tokens!.contrast.checks
    .map(
      (c) => `<tr class="${c.pass ? "" : "fail"}">
        <td>${esc(c.theme)}</td><td><code>${esc(c.pair)}</code></td>
        <td><span class="sample" style="color:${esc(c.fg)};background:${esc(c.bg)}">Aa ₹900</span></td>
        <td>${c.ratio}:1</td><td>${c.kind === "decorative" ? "decorative" : `${c.required}:1 ${esc(c.kind)}`}</td>
        <td>${c.pass ? '<span class="pill ok">pass</span>' : `<span class="pill bad">fail</span> ${esc(c.fix?.proposal ?? "")}`}</td></tr>`,
    )
    .join("");
  const v1Rows = tokens!.contrast.v1AsShipped
    .map(
      (c) => `<tr class="${c.pass ? "" : "fail"}"><td>${esc(c.label)}</td>
        <td><span class="sample" style="color:${esc(c.fg)};background:${esc(c.bg)}">Aa ₹900</span></td>
        <td>${c.ratio}:1</td><td>${c.required}:1</td><td>${c.pass ? '<span class="pill ok">pass</span>' : '<span class="pill bad">fail</span>'}</td></tr>`,
    )
    .join("");
  const decisions = tokens!.decisionsNeeded
    .map(
      (d) => `<div class="decision"><h4>${esc(d.question)}</h4>
      ${d.options.map((o) => `<p><b>${esc(o.label)}</b><br>${esc(o.detail)}</p>`).join("")}
      <p class="rec">Recommendation: <b>${esc(d.recommendation)}</b>. ${esc(d.applied ?? "")}</p>
      <div class="btnrow">
        <span class="btn" style="background:${esc(dark["--brand"].value)};color:#ffffff">Shop the Archive — v1 (white)</span>
        <span class="btn" style="background:#d14734;color:#ffffff">Option A</span>
        <span class="btn" style="background:${esc(dark["--brand"].value)};color:${esc(dark["--brand-ink"].value)}">Option B (proposed)</span>
      </div></div>`,
    )
    .join("");
  const shades = ["--brand-50", "--brand-100", "--brand", "--brand-600", "--brand-700"];
  return `
  <section id="colours">
    <h2>Colours</h2>
    <p>${esc(tokens!.finding)}</p>
    <h3>v1 theme variables (as shipped)</h3>
    <div class="grid">${v1}</div>
    <h3>v1 colours as rendered, by frequency</h3>
    <p class="muted">Every colour painted on home, category, product, cart and contact at 390px and 1440px. Translucent values show alpha as the last two hex digits.</p>
    <div class="grid">${palette}</div>
    <h3>Brand ramp (OKLCH lightness only)</h3>
    <div class="ramp">${shades.map((k) => `<div style="background:${dark[k].value};color:${k === "--brand-50" || k === "--brand-100" ? "#f2f2f2" : "#09090b"}">${k}<br><code>${dark[k].value}</code></div>`).join("")}</div>
    <div class="ramp light">${shades.map((k) => `<div style="background:${light[k].value};color:#0e0e11">${k}<br><code>${light[k].value}</code></div>`).join("")}</div>
    <h3>Proposed tokens — dark (default) and light</h3>
    <div class="scroll"><table><thead><tr><th>Token</th><th>Dark</th><th>Light</th><th>Usage</th><th>Source</th></tr></thead><tbody>${tokenRows}</tbody></table></div>
    <h3>Decision needed</h3>
    ${decisions}
    <h3>Contrast — proposed pairs (WCAG 2.2 AA)</h3>
    <div class="scroll"><table><thead><tr><th>Theme</th><th>Pair</th><th>Sample</th><th>Ratio</th><th>Needs</th><th>Result</th></tr></thead><tbody>${checkRows}</tbody></table></div>
    <h3>Contrast — v1 as shipped</h3>
    <div class="scroll"><table><thead><tr><th>Where</th><th>Sample</th><th>Ratio</th><th>Needs</th><th>Result</th></tr></thead><tbody>${v1Rows}</tbody></table></div>
  </section>`;
}

function type() {
  const seen = new Set<string>();
  const v1Specimens = (theme?.samples ?? [])
    .filter((s) => s.state === "default")
    .map((s) => ({ family: s.styles.fontFamily.split(",")[0].replace(/"/g, "").trim(), size: s.styles.fontSize, weight: s.styles.fontWeight, role: s.role, vp: s.viewport, lh: s.styles.lineHeight, ls: s.styles.letterSpacing, tt: s.styles.textTransform }))
    .filter((s) => {
      const key = `${s.family}|${s.size}|${s.weight}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.family.localeCompare(b.family) || parseFloat(b.size) - parseFloat(a.size));
  const v1Rows = v1Specimens
    .map(
      (s) => `<tr><td><small>${esc(s.family)} ${esc(s.weight)}<br>${esc(s.size)} / ${esc(s.lh)}${s.ls !== "normal" ? ` / ${esc(s.ls)}` : ""}${s.tt !== "none" ? ` / ${esc(s.tt)}` : ""}</small></td>
        <td><small>${esc(s.role)} @${esc(s.vp)}</small></td>
        <td><span style="font-family:'${esc(s.family)}';font-size:${esc(s.size)};font-weight:${esc(s.weight)};text-transform:${esc(s.tt)};letter-spacing:${esc(s.ls)};line-height:1.1">Wear the heritage. ₹900</span></td></tr>`,
    )
    .join("");
  const ts = tokens!.typeScale;
  const scaleRows = Object.entries(ts.steps)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([n, s]) => {
      const fam = Number(n) >= 2 ? "Outfit" : "Inter";
      const weight = Number(n) >= 2 ? 800 : 400;
      return `<tr><td><code>step ${esc(n)}</code><br><small>${s.px}px</small></td><td><small>${esc(s.use)}</small></td>
        <td><span style="font-family:'${fam}';font-weight:${weight};font-size:${Math.max(12, s.px)}px;line-height:1.1">${Number(n) >= 2 ? "Wear the heritage." : "Authenticated football jerseys, curated like museum pieces."}</span></td></tr>`;
    })
    .join("");
  const fams = Object.entries(ts.families)
    .map(([k, f]) => `<li><b>${esc(k)}:</b> ${esc(f.family)} ${esc(f.weights.join("/"))} — <small>${esc(f.source)}</small></li>`)
    .join("");
  return `
  <section id="type">
    <h2>Type</h2>
    <p>v1 loads <b>Outfit</b> (headings), <b>Inter</b> (body) and <b>JetBrains Mono</b> (prices, SKUs, labels) from Google Fonts. None is a system font, so v1's families are kept and self-hosted with next/font.</p>
    <h3>v1 — every family, size and weight found</h3>
    <div class="scroll"><table><tbody>${v1Rows}</tbody></table></div>
    <h3>Proposed scale — ${ts.base}px base, ${ts.ratio} ratio</h3>
    <ul>${fams}</ul>
    <p class="muted">${esc(ts.casing)}</p>
    <div class="scroll"><table><tbody>${scaleRows}</tbody></table></div>
    <div class="numbers">
      ${[7, 10, 10, 22, 7, 10].map((n) => `<span>${n}</span>`).join("")}
    </div>
    <p class="muted">Big Shoulders Display 900 for shirt numbers only, at <code>--number</code> (ink at 8%); hover a number to see <code>--brand</code>.</p>
  </section>`;
}

function catalogue() {
  const NEEDS = (p: Product) => {
    const needs = ["player", "shirt number", "season", "kit type", "fit", "stock per size (S–XXL)"];
    if (!p.country) needs.push("country");
    if (p.images.length < 3) needs.push(`more photos (has ${p.images.length}, gallery wants 3–5)`);
    if (p.images.some((i) => (i.width ?? 0) < 1000)) needs.push(`higher-resolution photo (current ${p.images[0].width}×${p.images[0].height})`);
    return needs;
  };
  const rows = products.products
    .map((p) => {
      const w = webpFor(p.images[0]?.file ?? null);
      const empty = (v: unknown) => (v == null || v === "" || (Array.isArray(v) && v.length === 0) ? ' class="empty"' : "");
      return `<tr>
        <td>${w ? `<img src="images/webp/${esc(w.webp)}" alt="${esc(p.images[0].alt)}" width="96" height="${Math.round((96 * w.height) / w.width)}">` : "—"}</td>
        <td><a href="${esc(p.v1Url)}">${esc(p.name)}</a><br><small class="mono">${esc(p.sku)}</small></td>
        <td${empty(p.club)}>${esc(p.club) || "empty"}</td>
        <td${empty(p.country)}>${esc(p.country) || "empty"}</td>
        <td>${esc(p.priceText)}</td>
        <td>${esc(p.audience.join(", "))}</td>
        <td>${esc(p.sizes.map((s) => s.label).join(" "))}<br><small>${esc(p.stockText)}</small></td>
        <td>${p.images.length}<br><small>${p.images.map((i) => `${i.width}×${i.height}`).join(", ")}</small></td>
        <td class="empty">empty</td><td class="empty">empty</td><td class="empty">empty</td><td class="empty">empty</td><td class="empty">empty</td>
        <td>${p.featuredOnHome ? `#${p.homePosition}` : "—"}</td>
      </tr>`;
    })
    .join("");
  const needs = products.products.map((p) => `<li><b>${esc(p.name)}</b>: ${esc(NEEDS(p).join(" · "))}</li>`).join("");
  return `
  <section id="products">
    <h2>Products</h2>
    <p>Recorded exactly as v1 shows them. Player, shirt number, season, kit type and fit are left <span class="empty inline">empty</span> on purpose — admins fill them in.</p>
    <div class="scroll"><table class="products"><thead><tr>
      <th>Image</th><th>Name / SKU</th><th>Club</th><th>Country</th><th>Price</th><th>Audience</th><th>Sizes</th><th>Images</th>
      <th>Player</th><th>Number</th><th>Season</th><th>Kit type</th><th>Fit</th><th>Home</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>What admins need to fill in</h3>
    <ol class="needs">${needs}</ol>
    <p class="muted">v1 also shows a “Fit: Men / Category: Men” block on every product; it is kept as raw data in products.json (<code>v1Details</code>) but not copied into the fit field.</p>
  </section>`;
}

function baselineSection() {
  if (!baseline) return "";
  const lh = baseline.lighthouse
    .map((r) =>
      r.error
        ? `<tr><td>${esc(r.page)}</td><td colspan="9">${esc(r.error)}</td></tr>`
        : `<tr><td>${esc(r.page)}</td>
        <td class="${r.scores.performance < 90 ? "bad" : ""}">${r.scores.performance}${r.performanceRange ? `<br><small>${r.performanceRange.join("–")}</small>` : ""}</td>
        <td class="${r.scores.accessibility < 95 ? "bad" : ""}">${r.scores.accessibility}</td><td>${r.scores.bestPractices}</td><td>${r.scores.seo}</td>
        <td>${(r.metrics.lcpMs / 1000).toFixed(1)} s</td><td>${r.metrics.cls}</td><td>${(r.metrics.fcpMs / 1000).toFixed(1)} s</td>
        <td>${r.weight.jsTransferKB} KB</td><td>${r.weight.totalTransferKB} KB / ${r.weight.totalRequests}</td></tr>`,
    )
    .join("");
  const axeIds = new Map<string, { impact: string; help: string; helpUrl: string; where: string[]; examples: string[] }>();
  for (const page of baseline.axe) {
    for (const v of page.violations) {
      const e = axeIds.get(v.id) ?? { impact: v.impact, help: v.help, helpUrl: v.helpUrl, where: [], examples: [] };
      e.where.push(`${page.page}@${page.viewport} (${v.count})`);
      for (const ex of v.examples) if (e.examples.length < 3 && !e.examples.includes(ex.target)) e.examples.push(ex.target);
      axeIds.set(v.id, e);
    }
  }
  const axe = [...axeIds.entries()]
    .map(
      ([id, v]) => `<tr><td><a href="${esc(v.helpUrl)}"><code>${esc(id)}</code></a></td><td><span class="pill ${v.impact === "critical" || v.impact === "serious" ? "bad" : "warn"}">${esc(v.impact)}</span></td>
      <td>${esc(v.help)}<br><small class="mono">${esc(v.examples.join("  ·  "))}</small></td><td><small>${esc(v.where.join(", "))}</small></td></tr>`,
    )
    .join("");
  const audit = baseline.designAudit
    .map(
      (a) => `<li><span class="pill ${a.severity === "high" ? "bad" : a.severity === "medium" ? "warn" : "ok"}">${esc(a.severity)}</span> <b>${esc(a.area)}.</b> ${esc(a.observation)}
      <span class="shots">${a.screenshots.map((s) => `<a href="screenshots/${esc(s)}">${esc(s)}</a>`).join(" ")}</span></li>`,
    )
    .join("");
  const shots = (theme?.screenshots ?? [])
    .map((s) => `<a href="screenshots/${esc(s.file)}" class="shot"><img src="screenshots/${esc(s.file)}" alt="v1 ${esc(s.page)} at ${esc(s.viewport)}" loading="lazy"><span>${esc(s.page)} · ${esc(s.viewport)}</span></a>`)
    .join("");
  return `
  <section id="baseline">
    <h2>Baseline — v1 today</h2>
    <h3>Lighthouse (mobile)</h3>
    <p class="muted">${esc(baseline.notes.join(" "))} Targets for v2: ≥ 95 on every category, &lt; 120 KB JS on product pages, CLS 0.</p>
    <div class="scroll"><table><thead><tr><th>Page</th><th>Perf</th><th>A11y</th><th>Best pr.</th><th>SEO</th><th>LCP</th><th>CLS</th><th>FCP</th><th>JS</th><th>Total / requests</th></tr></thead><tbody>${lh}</tbody></table></div>
    <h3>axe violations</h3>
    <div class="scroll"><table><thead><tr><th>Rule</th><th>Impact</th><th>What</th><th>Where (count)</th></tr></thead><tbody>${axe}</tbody></table></div>
    <h3>Design audit</h3>
    <ol class="audit">${audit}</ol>
    <h3>Screenshots</h3>
    <div class="shots-grid">${shots}</div>
  </section>`;
}

function copySection() {
  const c = copy?.copy as Record<string, unknown> | undefined;
  return `
  <section id="copy">
    <h2>Copy</h2>
    <p class="muted">Full structured copy is in copy.json (local only). Contact details below are private and appear only in this local report.</p>
    <pre>${esc(JSON.stringify({ hero: c?.hero, categoryTiles: c?.categoryTiles, trustPoints: c?.trustPoints, footer: c?.footer }, null, 2))}</pre>
    <h3>v1 contact details (private)</h3>
    <ul>
      <li>Email links: ${esc(contact?.mailto.join(", ") || "none")} — personal Gmail; never use publicly.</li>
      <li>Phone on contact page: 9764795606 (same as the WhatsApp number in the brief). Footer shows the placeholder “+91 XXXXX XXXXX”.</li>
      <li>Hours on contact page: ${esc((c?.contactPage as { hours?: string } | undefined)?.hours ?? "—")}</li>
      <li>Social links: instagram.com, twitter.com, facebook.com (bare home pages — no real profiles).</li>
      <li>WhatsApp links on v1: ${esc(contact?.whatsapp.join(", ") || "none")}</li>
    </ul>
  </section>`;
}

function seedSection() {
  return `
  <section id="seed">
    <h2>Seed — blocked</h2>
    <p>No <code>.env.local</code> exists yet, so migrations, image upload, product insert, admin accounts and live RLS checks were not run. The same migrations and RLS rules were verified against an in-memory Postgres (15 tests: anon reads catalogue, cannot write anything, cannot read orders or profiles, cannot upload images; customers cannot promote themselves; admins can write).</p>
    <h3>What to create and paste</h3>
    <ol>
      <li>Create two free Supabase projects at supabase.com: <b>kittora-staging</b> and <b>kittora-live</b> (region: Mumbai, ap-south-1).</li>
      <li>In each: <b>Project Settings → API</b>: copy the Project URL, the <code>anon</code> public key and the <code>service_role</code> key.</li>
      <li>In each: <b>Connect</b> (top bar) → <b>Session pooler</b> connection string (port 5432), with the database password filled in.</li>
      <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill: <code>STAGING_SUPABASE_URL</code>, <code>STAGING_SUPABASE_ANON_KEY</code>, <code>STAGING_SUPABASE_SERVICE_ROLE_KEY</code>, <code>STAGING_DATABASE_URL_DIRECT</code>, the same four <code>LIVE_*</code>, and <code>ADMIN_1..3_USERNAME</code> / <code>_PASSWORD</code> (passwords ≥ 12 characters). Also set <code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the staging values.</li>
      <li>Run <code>npm run seed -- --target staging</code>, check it, then <code>npm run seed -- --target live</code>.</li>
    </ol>
  </section>`;
}

// ------------------------------------------------------------------ page
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kittora v1 import report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{${cssVars(dark)}color-scheme:dark}
:root[data-theme="light"]{${cssVars(light)}color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 Inter,system-ui,sans-serif}
header.top{position:sticky;top:0;z-index:5;background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header.top b{font-family:Outfit;font-weight:800;letter-spacing:-.01em}
header.top nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
header.top button{margin-left:auto;background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:999px;padding:6px 14px;font:inherit;font-size:14px;cursor:pointer}
a{color:var(--brand-text)}a:focus-visible,button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
main{max-width:1280px;margin:0 auto;padding:24px 16px 96px}
h1{font:800 clamp(2.1rem,5vw,3.3rem)/1.05 Outfit;margin:24px 0 8px}
h2{font:700 33px/1.1 Outfit;margin:64px 0 16px;padding-top:16px;border-top:1px solid var(--line)}
h3{font:600 21px/1.2 Outfit;margin:36px 0 12px}h4{margin:0 0 8px}
p,li{max-width:70ch}.muted,small{color:var(--ink-muted)}small{display:block;font-size:13.6px}
code,.mono{font-family:'JetBrains Mono',monospace;font-size:.85em}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.stats div{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px}
.stats b{display:block;font:800 33px/1 Outfit;color:var(--brand-text)}.stats span{font-size:13.6px;color:var(--ink-muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.sw{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.sw .chip{height:64px;border-bottom:1px solid var(--line);background-image:linear-gradient(45deg,#8883 25%,transparent 25%,transparent 75%,#8883 75%),linear-gradient(45deg,#8883 25%,transparent 25%,transparent 75%,#8883 75%);background-size:12px 12px;background-position:0 0,6px 6px;background-blend-mode:normal}
.sw .chip{position:relative}.sw figcaption{padding:8px 10px;font-size:13.6px}.sw figcaption b,.sw figcaption code{display:block}
.ramp{display:grid;grid-template-columns:repeat(5,1fr);border-radius:16px;overflow:hidden;margin:8px 0}
.ramp div{padding:16px 10px;font-size:13.6px;font-weight:600}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:16px}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
th{background:var(--surface);font-weight:600;position:sticky;top:0}
tr.fail td{background:color-mix(in oklab,var(--brand-50) 60%,transparent)}
.dot{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:6px;border:1px solid var(--line-strong)}
.sample{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:600;border:1px solid var(--line)}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;margin-left:6px}
.pill.ok{background:color-mix(in oklab,var(--success) 22%,transparent);color:var(--success)}
.pill.bad{background:color-mix(in oklab,var(--brand) 22%,transparent);color:var(--brand-text)}
.pill.warn{background:color-mix(in oklab,var(--warning) 22%,transparent);color:var(--warning)}
td.bad{color:var(--brand-text);font-weight:600}
.empty{background:color-mix(in oklab,var(--warning) 14%,transparent);color:var(--warning);font-weight:600}.empty.inline{padding:0 6px;border-radius:6px}
table.products{min-width:1180px}table.products td:nth-child(2){min-width:220px}
@media (max-width:640px){header.top{position:static}}
.products img{display:block;border-radius:10px;background:var(--surface-2);height:auto}
.decision{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px}
.btnrow{display:flex;gap:10px;flex-wrap:wrap}.btn{border-radius:999px;padding:12px 20px;font-weight:600;font-size:15px}
.rec{color:var(--ink)}
.numbers{display:flex;gap:clamp(12px,3vw,40px);overflow-x:auto;padding:8px 0;scroll-snap-type:x mandatory}
.numbers span{font:900 clamp(6rem,14vw,14rem)/0.85 'Big Shoulders Display';letter-spacing:-.02em;color:var(--number);scroll-snap-align:start;transition:color .2s}
.numbers span:hover{color:var(--brand)}
@media (prefers-reduced-motion: reduce){.numbers span{transition:none}}
.audit li{margin-bottom:12px}.shots{display:block;font-size:13px}.shots a{margin-right:8px}
.shots-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.shot{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:var(--ink)}
.shot img{display:block;width:100%;height:220px;object-fit:cover;object-position:top}.shot span{display:block;padding:6px 10px;font-size:13px}
pre{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;overflow:auto;font:13px/1.5 'JetBrains Mono',monospace;max-height:420px}
.needs li{margin-bottom:6px}
</style>
</head>
<body>
<header class="top"><b>KITTORA</b><nav><a href="#summary">Summary</a><a href="#colours">Colours</a><a href="#type">Type</a><a href="#products">Products</a><a href="#baseline">Baseline</a><a href="#copy">Copy</a><a href="#seed">Seed</a></nav>
<button type="button" id="theme">Toggle light/dark</button></header>
<main>
<h1>v1 import report</h1>
<p class="muted">Phase 0.5 · generated ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC from https://terrace-archive-kit.base44.app. This page is styled with the proposed tokens: dark (v1’s default) — use “Toggle light/dark” to preview the light variant.</p>
${summary()}${colours()}${type()}${catalogue()}${baselineSection()}${copySection()}${seedSection()}
</main>
<script>
document.getElementById('theme').addEventListener('click',()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='light'?'dark':'light';});
</script>
</body>
</html>
`;

writeFileSync(join(IMPORT_DIR, "report.html"), html);
console.log(`Wrote ${join(IMPORT_DIR, "report.html")} (${(html.length / 1024).toFixed(0)} KB)`);
