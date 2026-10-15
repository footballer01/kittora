// Phase 0.5 — design token PROPOSAL built from v1's extracted theme.
// Nothing here is applied to the app; Phase 1 does that after review.
//
//   npx tsx scripts/import/tokens.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  composite,
  contrast,
  formatOklch,
  hexToOklch,
  hslVarToHex,
  minimalLightnessFix,
  oklchToHex,
  withLightness,
} from "@/lib/color";
import { IMPORT_DIR } from "./lib";

type Sample = { page: string; viewport: string; role: string; state: string; selector: string; styles: Record<string, string>; hex: Record<string, string> };
const theme = JSON.parse(readFileSync(join(IMPORT_DIR, "theme.json"), "utf8")) as {
  cssVariables: Record<string, Record<string, string>>;
  samples: Sample[];
  darkMode: { present: boolean; bodyBackgroundLight: string };
};

const root = theme.cssVariables[":root"] ?? {};
const v = (name: string) => {
  const raw = root[name];
  if (!raw) throw new Error(`v1 CSS variable ${name} not found in theme.json`);
  return hslVarToHex(raw);
};
const sample = (page: string, role: string, state = "default") =>
  theme.samples.find((s) => s.page === page && s.role === role && s.state === state && s.viewport === "desktop");

// ---------------------------------------------------------------- v1 colours
const V1 = {
  background: v("--background"),
  card: v("--card"),
  foreground: v("--foreground"),
  mutedForeground: v("--muted-foreground"),
  primary: v("--primary"),
  primaryForeground: v("--primary-foreground"),
  coralDark: v("--coral-dark"),
  border: v("--border"),
  sky: v("--sky"),
  sand: v("--sand"),
  graphite: v("--graphite"),
  muted: v("--muted"),
};
// v1's secondary text is foreground at 70% (descriptions, hero subline); the
// footer (v1's only light area) uses sand at 60% on graphite.
const v1BodyMuted = composite("#f2f2f2b3", V1.background);
const v1LabelMuted = composite("#f2f2f266", V1.background); // 40% labels (club, SKU)
const v1FooterMuted = composite("#0d0d1199", V1.graphite);
const v1FooterLine = composite("#0a0a141a", V1.graphite);

// ---------------------------------------------------------------- shades
const brand = hexToOklch(V1.primary);
const L = (l: number) => withLightness(V1.primary, l);
// Recommended (decision B): text on coral is v1's near-black, not white.
const BRAND_INK = V1.background;
// 700 = darkest coral that still keeps AA (4.6:1 for margin) with BRAND_INK;
// 600 sits halfway. v1's own hover (--coral-dark) would fail with dark text.
let l700 = brand.l;
while (l700 > 0 && contrast(L(l700 - 0.001), BRAND_INK) >= 4.6) l700 -= 0.001;
const step700 = l700 - brand.l;
const step600 = step700 / 2;
const firstPassing = (hex: string, against: string[], target: number) => {
  let best = hex;
  for (const bg of against) {
    const fix = minimalLightnessFix(best, bg, target);
    if (fix) best = fix.hex;
  }
  return best;
};

const midLightness = (a: string, b: string) => {
  const A = hexToOklch(a);
  const B = hexToOklch(b);
  return oklchToHex({ l: (A.l + B.l) / 2, c: (A.c + B.c) / 2, h: B.c > 0.002 ? B.h : A.h });
};
// Status hues matched to the brand's lightness and chroma.
const status = (h: number, l = brand.l) => oklchToHex({ l, c: brand.c, h });

type Token = { value: string; oklch: string; source: string; usage: string; changedFromV1?: { from: string; reason: string } };
const tok = (value: string, source: string, usage: string, extra: Partial<Token> = {}): Token => ({
  value,
  oklch: value.length === 7 ? formatOklch(hexToOklch(value)) : `${value} (with alpha)`,
  source,
  usage,
  ...extra,
});

// ---------------------------------------------------------------- dark (v1 default)
const dark: Record<string, Token> = {
  "--bg": tok(V1.background, "v1 :root --background (240 10% 4%); body wrapper `.bg-background`", "Page background"),
  "--surface": tok(V1.card, "v1 :root --card (240 10% 8%); product cards, inputs", "Cards, panels, inputs"),
  "--surface-2": tok(midLightness(V1.background, V1.card), "Proposed: OKLCH midpoint of --bg and --surface", "Peg rail band, drawers"),
  "--ink": tok(V1.foreground, "v1 :root --foreground (0 0% 95%)", "Body text and headings"),
  "--ink-muted": tok(v1BodyMuted, "v1 `text-graphite/70` (foreground at 70%) on --bg, flattened to a solid colour", "Secondary text, descriptions"),
  "--brand": tok(V1.primary, "v1 :root --primary (8 100% 68%) — coral", "Primary buttons, price, links on hover, focus ring"),
  "--brand-ink": tok(BRAND_INK, "v1 --background (near-black); recommended decision B", "Text on --brand", {
    changedFromV1: { from: V1.primaryForeground, reason: "White on coral is 2.69:1 (fails AA). Near-black on coral is 7.4:1 and keeps the coral fill exactly." },
  }),
  "--brand-text": tok(V1.primary, "v1 --primary (passes on dark)", "Brand-coloured text: price, links"),
  "--focus": tok(V1.primary, "v1 --ring (8 100% 68%)", "Focus ring, 2px"),
  "--line": tok(V1.border, "v1 :root --border (240 8% 16%)", "Dividers, card borders (decorative)"),
  "--line-strong": tok(firstPassing(V1.border, [V1.background, V1.card], 3), "Derived: --line with the smallest lightness change for 3:1 on --bg and --surface", "Input and select borders (WCAG 1.4.11)"),
  "--accent": tok(V1.sky, "v1 :root --secondary / --sky (217 60% 71%)", "Kept from v1: trust-point icon tint; use sparingly"),
  "--brand-600": tok(L(brand.l + step600), `Derived: --brand lightness ${(step600 * 100).toFixed(1)}% (v1 hover --coral-dark ${V1.coralDark} fails with dark text)`, "Hover"),
  "--brand-700": tok(L(brand.l + step700), `Derived: --brand lightness ${(step700 * 100).toFixed(1)}%`, "Pressed"),
  "--brand-50": tok(L(0.24), "Derived: --brand at L 24% (dark-theme tint)", "Selected size, chips (background)"),
  "--brand-100": tok(L(0.3), "Derived: --brand at L 30% (dark-theme tint)", "Highlights, hover on chips"),
  "--success": tok(status(150), `Proposed: hue 150, brand L ${(brand.l * 100).toFixed(1)}% and C ${brand.c.toFixed(3)}`, "In stock, deliverable"),
  "--warning": tok(status(85), `Proposed: hue 85, brand L ${(brand.l * 100).toFixed(1)}% and C ${brand.c.toFixed(3)}`, "Low stock"),
  "--number": tok(`${V1.foreground}14`, "Proposed: --ink at 8% opacity", "Ghosted shirt numbers; switch to --brand on hover"),
};

// ---------------------------------------------------------------- light variant, from v1's light footer
const light: Record<string, Token> = {
  "--bg": tok(V1.graphite, "v1 footer background (`--graphite`, 0 0% 95%)", "Page background"),
  "--surface": tok("#ffffff", "Proposed: white, one step above --bg", "Cards, panels, inputs"),
  "--surface-2": tok(midLightness(V1.graphite, "#ffffff"), "Proposed: OKLCH midpoint of --bg and --surface", "Peg rail band, drawers"),
  "--ink": tok(V1.sand, "v1 footer text (`--sand`, 240 10% 6%)", "Body text and headings"),
  "--ink-muted": tok(v1FooterMuted, "v1 footer `text-sand/60` on --bg, flattened", "Secondary text"),
  "--brand": tok(V1.primary, "v1 --primary (unchanged)", "Primary buttons, focus ring"),
  "--brand-ink": tok(BRAND_INK, "Same as dark (decision B)", "Text on --brand", {
    changedFromV1: { from: V1.primaryForeground, reason: "White on coral fails AA." },
  }),
  "--brand-text": tok(firstPassing(V1.primary, [V1.graphite, "#ffffff"], 4.5), "Derived: --brand with the smallest lightness change for 4.5:1 on --bg and --surface", "Brand-coloured text on light", {
    changedFromV1: { from: V1.primary, reason: "Coral text on v1's light footer is 2.4:1." },
  }),
  "--focus": tok(firstPassing(V1.primary, [V1.graphite, "#ffffff"], 3), "Derived: --brand with the smallest lightness change for 3:1 (non-text) on --bg and --surface", "Focus ring"),
  "--line": tok(v1FooterLine, "v1 footer divider `border-sand/10`, flattened", "Dividers (decorative)"),
  "--line-strong": tok(firstPassing(v1FooterLine, [V1.graphite, "#ffffff"], 3), "Derived: --line with the smallest lightness change for 3:1 on --bg and --surface", "Input and select borders"),
  "--accent": tok(V1.sky, "v1 --sky", "Trust-point icon tint"),
  "--brand-600": tok(L(brand.l + step600), "Same as dark", "Hover"),
  "--brand-700": tok(L(brand.l + step700), "Same as dark", "Pressed; brand-coloured text on light"),
  "--brand-50": tok(L(0.97), "Derived: --brand at L 97%", "Selected size, chips"),
  "--brand-100": tok(L(0.93), "Derived: --brand at L 93%", "Highlights"),
  "--success": tok(firstPassing(status(150), [V1.graphite, "#ffffff"], 4.5), "Proposed: dark-theme --success with the smallest lightness change for 4.5:1 on --bg and --surface", "In stock"),
  "--warning": tok(firstPassing(status(85), [V1.graphite, "#ffffff"], 4.5), "Proposed: dark-theme --warning with the smallest lightness change for 4.5:1 on --bg and --surface", "Low stock"),
  "--number": tok(`${V1.sand}14`, "Proposed: --ink at 8% opacity", "Ghosted shirt numbers"),
};

// ---------------------------------------------------------------- contrast checks
type Check = {
  theme: string;
  pair: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  kind: "text" | "large text" | "non-text" | "decorative";
  pass: boolean;
  fix?: { proposal: string; options: { change: string; before: string; after: string; deltaL: number; ratio: number }[] };
};

function solid(hex: string, bg: string) {
  return hex.length === 9 ? composite(hex, bg) : hex;
}

function check(themeName: string, tokens: Record<string, Token>, fgKey: string, bgKey: string, kind: Check["kind"]): Check {
  const bg = solid(tokens[bgKey]?.value ?? bgKey, tokens["--bg"].value);
  const fg = solid(tokens[fgKey]?.value ?? fgKey, bg);
  const required = kind === "text" ? 4.5 : kind === "decorative" ? 1 : 3;
  const ratio = contrast(fg, bg);
  const c: Check = { theme: themeName, pair: `${fgKey} on ${bgKey}`, fg, bg, ratio: Number(ratio.toFixed(2)), required, kind, pass: ratio >= required };
  if (!c.pass) {
    const options = [];
    const fgFix = minimalLightnessFix(fg, bg, required);
    if (fgFix) options.push({ change: fgKey, before: fg, after: fgFix.hex, deltaL: Number(fgFix.deltaL.toFixed(3)), ratio: Number(fgFix.ratio.toFixed(2)) });
    const bgFix = minimalLightnessFix(bg, fg, required);
    if (bgFix) options.push({ change: bgKey, before: bg, after: bgFix.hex, deltaL: Number(bgFix.deltaL.toFixed(3)), ratio: Number(bgFix.ratio.toFixed(2)) });
    options.sort((a, b) => Math.abs(a.deltaL) - Math.abs(b.deltaL));
    c.fix = { proposal: options[0] ? `Smallest change: ${options[0].change} ${options[0].before} → ${options[0].after}` : "No lightness-only fix", options };
  }
  return c;
}

const PAIRS: [string, string, Check["kind"]][] = [
  ["--ink", "--bg", "text"],
  ["--ink", "--surface", "text"],
  ["--ink", "--surface-2", "text"],
  ["--ink-muted", "--bg", "text"],
  ["--ink-muted", "--surface", "text"],
  ["--brand-text", "--bg", "text"],
  ["--brand-text", "--surface", "text"],
  ["--brand-ink", "--brand", "text"],
  ["--brand-ink", "--brand-600", "text"],
  ["--brand-ink", "--brand-700", "text"],
  ["--ink", "--brand-50", "text"],
  ["--ink", "--brand-100", "text"],
  ["--brand-text", "--brand-50", "text"],
  ["--success", "--surface", "text"],
  ["--success", "--bg", "text"],
  ["--warning", "--surface", "text"],
  ["--warning", "--bg", "text"],
  ["--focus", "--bg", "non-text"],
  ["--focus", "--surface", "non-text"],
  ["--line-strong", "--bg", "non-text"],
  ["--line-strong", "--surface", "non-text"],
  ["--line", "--bg", "decorative"],
  ["--accent", "--bg", "decorative"],
];

const checks = [
  ...PAIRS.map(([f, b, k]) => check("dark", dark, f, b, k)),
  ...PAIRS.map(([f, b, k]) => check("light", light, f, b, k)),
];

// v1 as shipped: pairs that exist today.
const v1Checks = [
  { label: "Body text (foreground on background)", fg: V1.foreground, bg: V1.background, required: 4.5 },
  { label: "Secondary text (foreground/70 on background)", fg: v1BodyMuted, bg: V1.background, required: 4.5 },
  { label: "Card labels: club, SKU (foreground/40, 10–12px mono)", fg: v1LabelMuted, bg: V1.card, required: 4.5 },
  { label: "Primary button: white on coral", fg: V1.primaryForeground, bg: V1.primary, required: 4.5 },
  { label: "Primary button hover: white on coral-dark", fg: V1.primaryForeground, bg: V1.coralDark, required: 4.5 },
  { label: "Price: coral on background", fg: V1.primary, bg: V1.background, required: 4.5 },
  { label: "Footer text: sand/60 on graphite", fg: v1FooterMuted, bg: V1.graphite, required: 4.5 },
  { label: "Footer icons and hover: coral on graphite", fg: V1.primary, bg: V1.graphite, required: 3 },
  { label: "Card borders: border on background (non-text)", fg: V1.border, bg: V1.background, required: 3 },
  { label: "In stock: green-700 on background", fg: "#15803d", bg: V1.background, required: 4.5 },
].map((c) => {
  const ratio = contrast(c.fg, c.bg);
  return { ...c, ratio: Number(ratio.toFixed(2)), pass: ratio >= c.required };
});

// ---------------------------------------------------------------- type
const BASE = 17;
const RATIO = 1.25;
const step = (n: number) => Number((BASE * RATIO ** n).toFixed(2));
const typeScale = {
  base: BASE,
  ratio: RATIO,
  steps: {
    "-2": { px: step(-2), use: "Fine print (floor at 12px)" },
    "-1": { px: step(-1), use: "Small text, labels, SKU, captions" },
    "0": { px: step(0), use: "Body, buttons, inputs" },
    "1": { px: step(1), use: "h4, lead paragraph" },
    "2": { px: step(2), use: "h3, card titles at desktop" },
    "3": { px: step(3), use: "h2 on mobile" },
    "4": { px: step(4), use: "h2 desktop, h1 mobile" },
    "5": { px: step(5), use: "h1 desktop, hero on mobile" },
    "6": { px: step(6), use: "Hero on desktop (“Wear the heritage.”)" },
  },
  families: {
    heading: { family: "Outfit", weights: [600, 700, 800], source: "v1 --font-heading / --font-display (Google Fonts) → self-host via next/font" },
    body: { family: "Inter", weights: [400, 500, 600], source: "v1 --font-body (Google Fonts) → self-host via next/font" },
    mono: { family: "JetBrains Mono", weights: [400, 600], source: "v1 --font-mono: price, SKU, small labels" },
    numbers: { family: "Big Shoulders Display", weights: [800, 900], source: "New (Kit Room): shirt numbers and peg rail only", size: "clamp(6rem, 14vw, 14rem)", tracking: "-0.02em" },
  },
  lineHeights: { body: 1.6, heading: 1.1, display: 1.02 },
  measure: "≤ 70ch for body copy",
  casing: "Sentence case everywhere. v1's uppercase mono labels (club, CURATED, SHOP) become sentence case.",
};

const v1Type = Object.fromEntries(
  ["h1", "h2", "h3", "h4", "text.body", "text.muted", "text.small", "eyebrow", "button.primary", "nav.link", "price", "sku", "footer.heading"].map((role) => {
    const found = ["home", "product", "category", "contact", "cart"]
      .map((p) => sample(p, role))
      .filter(Boolean) as Sample[];
    const mobile = theme.samples.find((s) => s.role === role && s.viewport === "mobile" && s.state === "default");
    const s = found[0];
    return [
      role,
      s
        ? {
            page: s.page,
            selector: s.selector,
            family: s.styles.fontFamily.split(",")[0].replace(/"/g, ""),
            weight: s.styles.fontWeight,
            sizeDesktop: s.styles.fontSize,
            sizeMobile: mobile?.styles.fontSize ?? null,
            lineHeight: s.styles.lineHeight,
            letterSpacing: s.styles.letterSpacing,
            transform: s.styles.textTransform,
          }
        : null,
    ];
  }),
);

const shape = {
  radius: { input: "12px (v1 --radius .75rem)", card: "16px (v1 rounded-2xl)", pill: "9999px (v1 buttons, sizes, chips)" },
  container: "1280px max (v1 max-w-7xl) with 16/24/32px gutters",
  sectionSpacing: "80px desktop (v1 py-20), 56px mobile",
  focusRing: "2px solid --brand, 2px offset (v1 has none beyond browser default, except inputs)",
};

const proposal = {
  generatedAt: new Date().toISOString(),
  status: "PROPOSAL — not applied. Review in report.html, then Phase 1 builds styles/tokens.css from the accepted version.",
  finding:
    "v1 is a dark theme (near-black page, coral primary, sky accent) with a light footer. Following the brief, dark stays the default and a light variant is derived from v1's own light footer colours.",
  v1Colours: V1,
  themes: { dark, light },
  contrast: { checks, v1AsShipped: v1Checks },
  decisionsNeeded: [
    {
      id: "brand-ink",
      question: "White text on coral fails AA. Pick one:",
      options: [
        {
          label: "A — smallest lightness change: darken the button fill",
          detail: `Button fill becomes ${minimalLightnessFix(V1.primary, "#ffffff", 4.5)?.hex} (ΔL ${minimalLightnessFix(V1.primary, "#ffffff", 4.5)?.deltaL.toFixed(3)}), white text stays. Coral remains for price, links and the focus ring on dark. Hover/pressed would then go darker from there.`,
        },
        {
          label: "B — keep v1 coral fill exactly, switch button text to near-black",
          detail: `--brand-ink ${V1.primaryForeground} → ${V1.background}: ${contrast(V1.background, V1.primary).toFixed(2)}:1. Larger lightness change to the text colour, but the coral button — v1's most recognisable element — is unchanged.`,
        },
      ],
      recommendation: "B",
      applied: "B is applied in the proposed values above; switching to A changes --brand-ink, --brand-600 and --brand-700 only.",
    },
  ],
  typeScale,
  v1Type,
  shape,
};

writeFileSync(join(IMPORT_DIR, "tokens.proposal.json"), JSON.stringify(proposal, null, 2) + "\n");

const fails = checks.filter((c) => !c.pass);
console.log(`Dark tokens: ${Object.keys(dark).length}, light tokens: ${Object.keys(light).length}`);
console.log(`Contrast: ${checks.length - fails.length}/${checks.length} pass`);
for (const f of fails) console.log(`  ✗ ${f.theme} ${f.pair} ${f.ratio}:1 (need ${f.required}) → ${f.fix?.proposal}`);
console.log("v1 as shipped:");
for (const c of v1Checks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}: ${c.ratio}:1`);
