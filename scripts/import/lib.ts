// Shared helpers for the v1 import scripts. Read-only: these scripts only load
// pages; they never click "Add to cart", submit forms or change anything on v1.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";

export const V1_ORIGIN = "https://terrace-archive-kit.base44.app";
export const IMPORT_DIR = dirname(fileURLToPath(import.meta.url));
export const RAW_DIR = join(IMPORT_DIR, "raw");
export const IMAGES_DIR = join(IMPORT_DIR, "images");
export const ORIGINALS_DIR = join(IMAGES_DIR, "originals");
export const WEBP_DIR = join(IMAGES_DIR, "webp");
export const SCREENSHOTS_DIR = join(IMPORT_DIR, "screenshots");

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

const DELAY_MS = 1500;
const RETRIES = 2;

export function ensureDirs() {
  for (const d of [RAW_DIR, ORIGINALS_DIR, WEBP_DIR, SCREENSHOTS_DIR]) mkdirSync(d, { recursive: true });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function launch(): Promise<Browser> {
  return chromium.launch();
}

/** New page with a shim for the `__name` helper tsx/esbuild adds to functions passed to page.evaluate. */
export async function newPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript({ content: "globalThis.__name = (f) => f;" });
  return page;
}

/** True once a v1 page has rendered its real content (it is client-rendered). */
async function waitForContent(page: Page, path: string) {
  if (path.startsWith("/product/")) {
    await page.locator("h1").first().waitFor({ timeout: 30_000 });
  } else if (path.startsWith("/category/")) {
    // Either product cards or the empty state.
    await page
      .locator('a[href^="/product/"], :text("No jerseys found")')
      .first()
      .waitFor({ timeout: 30_000 });
  } else {
    await page.locator("main, h1").first().waitFor({ timeout: 30_000 });
  }
  // Let late images/fonts settle.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** Polite navigation: delay before every page, 2 retries on failure. */
export async function visit(page: Page, path: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    await sleep(attempt === 0 ? DELAY_MS : DELAY_MS * (attempt + 1));
    try {
      await page.goto(V1_ORIGIN + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await waitForContent(page, path);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`  retry ${attempt + 1}/${RETRIES} for ${path}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  throw new Error(`Failed to load ${path} after ${RETRIES + 1} attempts: ${String(lastError)}`);
}

/** Full-resolution URL: drop Base44's `/v1/fill/...` or `/v1/fit/...` resize suffix. */
export function fullResolution(url: string): string {
  return url.replace(/(\/images\/public\/[^/]+\/[^/]+?)\/v1\/(?:fill|fit)\/[^/]+\/[^/?#]+$/, "$1");
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/#/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Detect type and pixel size from file bytes (JPEG, PNG, WebP, GIF). Extensions on v1 can lie. */
export function sniffImage(buf: Uint8Array): { type: "jpeg" | "png" | "webp" | "gif"; width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length > 24 && dv.getUint32(0) === 0x89504e47) {
    return { type: "png", width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { type: "gif", width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  }
  if (buf.length > 30 && dv.getUint32(0) === 0x52494646 && dv.getUint32(8) === 0x57454250) {
    const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (chunk === "VP8X") return { type: "webp", width: 1 + (dv.getUint32(24, true) & 0xffffff), height: 1 + (dv.getUint32(27, true) & 0xffffff) };
    if (chunk === "VP8 ") return { type: "webp", width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const b = dv.getUint32(21, true);
      return { type: "webp", width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = dv.getUint16(i + 2);
      // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpeg", height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}
