// Phase 0.5 — extract v1's theme from computed styles, plus full-page
// screenshots. Read-only: hovers and focuses elements but never clicks
// anything that changes state (no add to cart, no form submit).
//
//   npx tsx scripts/import/theme.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { IMPORT_DIR, SCREENSHOTS_DIR, VIEWPORTS, ensureDirs, launch, newPage, visit } from "./lib";

const products = JSON.parse(readFileSync(join(IMPORT_DIR, "products.json"), "utf8")).products as { v1Id: string }[];

const PAGES = [
  { key: "home", path: "/" },
  { key: "category", path: "/category/all" },
  { key: "product", path: `/product/${products[0].v1Id}` },
  { key: "cart", path: "/cart" },
  { key: "contact", path: "/contact" },
] as const;

/** Element roles to sample, as functions run in the page that return elements. */
const ROLE_FINDERS = `
(() => {
  const all = (s) => [...document.querySelectorAll(s)];
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const first = (s, pred = () => true) => all(s).find((e) => visible(e) && pred(e)) || null;
  const byText = (s, re) => first(s, (e) => re.test((e.textContent || '').trim()));
  const main = document.querySelector('main') || document.querySelector('#root');
  return {
    'page.body': document.body,
    'page.root': document.querySelector('#root > div') || document.querySelector('#root'),
    'header': first('header') || first('nav'),
    'header.logo-mark': first('header span, nav span', (e) => (e.textContent || '').trim() === 'K'),
    'header.wordmark': first('header span, nav span', (e) => (e.textContent || '').trim() === 'KITTORA'),
    'nav.link': first('header a[href^="/category"], nav a[href^="/category"]'),
    'nav.link-active': first('header a, nav a', (e) => /active|text-coral|font-semibold/.test(e.className)),
    'footer': first('footer'),
    'footer.heading': first('footer p, footer h4, footer h3', (e) => /^[A-Z ]{3,}$/.test((e.textContent || '').trim())),
    'footer.link': first('footer a[href^="/"]'),
    'footer.small': byText('footer p, footer span', /©/),
    'h1': first('h1'),
    'h2': first('h2'),
    'h3': first('h3'),
    'h4': first('h4'),
    'eyebrow': first('p, span', (e) => /^[A-Z][A-Z ·]{4,}$/.test((e.textContent || '').trim()) && !e.closest('footer') && e.children.length === 0),
    'text.body': first('main p, #root p', (e) => (e.textContent || '').length > 60 && !e.closest('footer')),
    'text.muted': first('p, span', (e) => /\\/(40|50|60|70)/.test(e.className) && (e.textContent || '').trim().length > 3 && !e.closest('footer')),
    'text.small': first('p, span', (e) => /text-(xs|sm)/.test(e.className) && !e.closest('footer, header')),
    'link.inline': first('main a, #root a', (e) => !e.closest('header, footer, nav') && !/rounded-full|px-6|px-8/.test(e.className) && (e.textContent || '').trim().length > 2),
    'button.primary': byText('a, button', /^Shop the Archive$|^Buy Now$|^Send Message$|^Browse Jerseys$/i),
    'button.secondary': byText('a, button', /^Explore Men$|^Add to Cart$/i),
    'button.size': byText('button', /^M$/),
    'button.size-selected': byText('button', /^S$/),
    'card.product': first('a[href^="/product/"]'),
    'card.product-media': (() => { const a = first('a[href^="/product/"]'); return a ? a.querySelector('div') : null; })(),
    'card.category-tile': first('a[href^="/category/"]', (e) => !!e.querySelector('h3')),
    'card.trust': (() => { const s = [...document.querySelectorAll('section')].find((x) => /Authenticated/.test(x.textContent || '')); return s ? s.querySelector('div > div') : null; })(),
    'price': first('span, p', (e) => /^₹\\s?\\d/.test((e.textContent || '').trim())),
    'sku': first('span, p', (e) => /^KTR-/.test((e.textContent || '').trim())),
    'badge.stock': first('span', (e) => /in stock/i.test((e.textContent || '').trim())),
    'input.text': first('input:not([type=hidden]), select'),
    'input.textarea': first('textarea'),
    'image.product': first('img', (e) => /\\/files\\//.test(e.currentSrc || e.src)),
    'section': first('section'),
    'container': first('[class*="max-w-"]'),
    'grid': first('[class*="grid-cols"]'),
    'divider': first('*', (e) => { const cs = getComputedStyle(e); return cs.borderTopWidth === '1px' && cs.borderTopStyle !== 'none' && e.getBoundingClientRect().width > 300; }),
  };
})()
`;

const STYLE_PROPS = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderTopColor",
  "borderTopWidth",
  "borderTopStyle",
  "borderRadius",
  "boxShadow",
  "outlineColor",
  "outlineWidth",
  "outlineStyle",
  "outlineOffset",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "textDecorationLine",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginBottom",
  "maxWidth",
  "width",
  "height",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "opacity",
  "transitionDuration",
  "backdropFilter",
] as const;

type Sample = {
  page: string;
  viewport: keyof typeof VIEWPORTS;
  role: string;
  state: "default" | "hover" | "focus";
  selector: string;
  text: string;
  styles: Record<string, string>;
  hex: Record<string, string>;
};

/** Sample every role on the current page. Colours are normalised to hex via a canvas pixel. */
async function sampleRoles(page: Page, pageKey: string, viewport: keyof typeof VIEWPORTS): Promise<Sample[]> {
  const handles = await page.evaluateHandle(ROLE_FINDERS);
  const roles = (await page.evaluate((h) => Object.keys(h as object), handles)) as string[];
  const out: Sample[] = [];
  for (const role of roles) {
    const el = await page.evaluateHandle(({ h, role }) => (h as Record<string, Element | null>)[role], { h: handles, role });
    const isEl = await page.evaluate((e) => e instanceof Element, el);
    if (!isEl) continue;
    const states: Sample["state"][] = /^(button|nav\.link$|link|card|input|footer\.link)/.test(role) ? ["default", "hover", "focus"] : ["default"];
    for (const state of states) {
      const elem = el.asElement()!;
      try {
        if (state === "hover") {
          await elem.scrollIntoViewIfNeeded();
          await elem.hover({ timeout: 3000 });
          await page.waitForTimeout(400);
        } else if (state === "focus") {
          await page.mouse.move(0, 0);
          await page.keyboard.press("Tab"); // switch Chromium to keyboard modality so :focus-visible applies
          await elem.evaluate((e) => (e as HTMLElement).focus());
          await page.waitForTimeout(250);
        }
      } catch {
        continue;
      }
      const data = await elem.evaluate((e, props) => {
        const cs = getComputedStyle(e);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const toHex = (c: string) => {
          if (!c || c === "none" || c.startsWith("url")) return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          if (a === 0) return "transparent";
          const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
          return a < 255 ? `${hex}${a.toString(16).padStart(2, "0")}` : hex;
        };
        const styles: Record<string, string> = {};
        for (const p of props) styles[p] = (cs as unknown as Record<string, string>)[p];
        const hex: Record<string, string> = {};
        for (const p of ["color", "backgroundColor", "borderTopColor", "outlineColor"]) {
          const h = toHex(styles[p]);
          if (h) hex[p] = h;
        }
        // Short, readable selector: up to 3 ancestors, tag + first 3 classes.
        const part = (n: Element) => {
          const cls = [...n.classList].slice(0, 3).map((c) => "." + CSS.escape(c)).join("");
          return n.id ? `#${n.id}` : n.tagName.toLowerCase() + cls;
        };
        const chain: string[] = [];
        for (let n: Element | null = e; n && chain.length < 4 && n !== document.documentElement; n = n.parentElement) chain.unshift(part(n));
        return { styles, hex, selector: chain.join(" > "), text: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50) };
      }, STYLE_PROPS as unknown as string[]);
      out.push({ page: pageKey, viewport, role, state, ...data });
    }
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }
  return out;
}

/** Every colour used on the page, with counts and where it appears. */
async function pagePalette(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const toHex = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a === 0) return null;
      const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return a < 255 ? `${hex}${a.toString(16).padStart(2, "0")}` : hex;
    };
    const counts: Record<string, { count: number; props: Record<string, number>; examples: string[] }> = {};
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim());
      const entries: [string, string][] = [["backgroundColor", cs.backgroundColor]];
      if (hasText) entries.push(["color", cs.color]);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") entries.push(["borderColor", cs.borderTopColor]);
      for (const [prop, val] of entries) {
        const hex = toHex(val);
        if (!hex) continue;
        counts[hex] ??= { count: 0, props: {}, examples: [] };
        counts[hex].count++;
        counts[hex].props[prop] = (counts[hex].props[prop] ?? 0) + 1;
        if (counts[hex].examples.length < 4) counts[hex].examples.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join(".")}`);
      }
    }
    return counts;
  });
}

async function fontInfo(page: Page) {
  return page.evaluate(() => ({
    stylesheets: [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"], link[rel="preconnect"]')].map(
      (l) => ({ rel: l.getAttribute("rel"), href: (l as HTMLLinkElement).href }),
    ),
    loadedFaces: [...document.fonts].filter((f) => f.status === "loaded").map((f) => ({ family: f.family, weight: f.weight, style: f.style })),
    fontFiles: performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => /\.(woff2?|ttf|otf)(\?|$)|fonts\.(gstatic|googleapis)/.test(n)),
    fontFaceRules: (() => {
      const out: string[] = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) if (rule instanceof CSSFontFaceRule) out.push(rule.cssText.slice(0, 300));
        } catch {
          out.push(`(cross-origin sheet: ${sheet.href})`);
        }
      }
      return out;
    })(),
  }));
}

async function cssVariablesAndDarkMode(page: Page) {
  return page.evaluate(() => {
    const vars: Record<string, Record<string, string>> = {};
    const darkSignals: string[] = [];
    const visit = (rules: CSSRuleList, media = "") => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) {
          if (/prefers-color-scheme:\s*dark/.test(rule.conditionText)) darkSignals.push(`@media ${rule.conditionText}`);
          visit(rule.cssRules, rule.conditionText);
        } else if (rule instanceof CSSStyleRule) {
          if (/(^|[\s,])\.dark\b|\[data-theme=["']?dark/.test(rule.selectorText)) darkSignals.push(rule.selectorText.slice(0, 80));
          if (/^(:root|html|\.dark|\.light|body)$/.test(rule.selectorText.trim()) || rule.selectorText.includes(":root")) {
            for (const name of rule.style) {
              if (name.startsWith("--")) {
                const key = (media ? `@media ${media} ` : "") + rule.selectorText;
                vars[key] ??= {};
                vars[key][name] = rule.style.getPropertyValue(name).trim();
              }
            }
          }
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {
        /* cross-origin */
      }
    }
    return { vars, darkSignals: [...new Set(darkSignals)].slice(0, 20), htmlClass: document.documentElement.className };
  });
}

async function main() {
  ensureDirs();
  const browser = await launch();
  const samples: Sample[] = [];
  const palettes: Record<string, Awaited<ReturnType<typeof pagePalette>>> = {};
  let fonts: Awaited<ReturnType<typeof fontInfo>> | null = null;
  let cssVars: Awaited<ReturnType<typeof cssVariablesAndDarkMode>> | null = null;
  const screenshots: { page: string; viewport: string; file: string }[] = [];

  for (const [vpKey, vp] of Object.entries(VIEWPORTS) as [keyof typeof VIEWPORTS, { width: number; height: number }][]) {
    const page = await newPage(browser, vp);
    for (const { key, path } of PAGES) {
      console.log(`→ ${vpKey} ${path}`);
      await visit(page, path);
      // Scroll through so lazy content renders, then back to top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      const file = `${key}-${vp.width}.png`;
      await page.screenshot({ path: join(SCREENSHOTS_DIR, file), fullPage: true });
      screenshots.push({ page: key, viewport: vpKey, file });
      samples.push(...(await sampleRoles(page, key, vpKey)));
      palettes[`${key}@${vp.width}`] = await pagePalette(page);
      if (vpKey === "desktop" && key === "home") {
        fonts = await fontInfo(page);
        cssVars = await cssVariablesAndDarkMode(page);
      }
    }
    await page.close();
  }

  // Dark mode: does anything change when the OS asks for dark?
  const darkPage = await browser.newPage({ viewport: VIEWPORTS.desktop, colorScheme: "dark" });
  await darkPage.addInitScript({ content: "globalThis.__name = (f) => f;" });
  await visit(darkPage, "/");
  const darkBody = await darkPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await darkPage.screenshot({ path: join(SCREENSHOTS_DIR, "home-1440-prefers-dark.png") });
  const lightBody = samples.find((s) => s.page === "home" && s.role === "page.body" && s.viewport === "desktop")?.styles.backgroundColor;
  await browser.close();

  // Merge palettes across pages.
  const palette: Record<string, { count: number; props: Record<string, number>; pages: string[]; examples: string[] }> = {};
  for (const [pageKey, p] of Object.entries(palettes)) {
    for (const [hex, v] of Object.entries(p)) {
      palette[hex] ??= { count: 0, props: {}, pages: [], examples: [] };
      palette[hex].count += v.count;
      for (const [k, n] of Object.entries(v.props)) palette[hex].props[k] = (palette[hex].props[k] ?? 0) + n;
      palette[hex].pages.push(pageKey);
      for (const ex of v.examples) if (palette[hex].examples.length < 6 && !palette[hex].examples.includes(ex)) palette[hex].examples.push(ex);
    }
  }
  const sortedPalette = Object.entries(palette)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([hex, v]) => ({ hex, ...v }));

  const theme = {
    source: "https://terrace-archive-kit.base44.app",
    capturedAt: new Date().toISOString(),
    viewports: VIEWPORTS,
    pages: PAGES,
    darkMode: {
      present: (cssVars?.darkSignals.length ?? 0) > 0 && darkBody !== lightBody,
      bodyBackgroundLight: lightBody,
      bodyBackgroundWhenOsDark: darkBody,
      cssSignals: cssVars?.darkSignals ?? [],
    },
    cssVariables: cssVars?.vars ?? {},
    fonts,
    palette: sortedPalette,
    samples,
    screenshots,
  };
  writeFileSync(join(IMPORT_DIR, "theme.json"), JSON.stringify(theme, null, 2) + "\n");
  console.log(`\n${samples.length} style samples, ${sortedPalette.length} colours, ${screenshots.length + 1} screenshots.`);
  console.log(`Dark mode: ${theme.darkMode.present ? "present" : "not present"} (body ${lightBody} → ${darkBody} with OS dark)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
