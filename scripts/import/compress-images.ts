// Compress every downloaded original to WebP using lib/images/compress.ts —
// the same module the admin upload uses — run inside headless Chromium.
//
//   npx tsx scripts/import/compress-images.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { build } from "esbuild";
import { IMPORT_DIR, ORIGINALS_DIR, WEBP_DIR, ensureDirs, launch, newPage } from "./lib";

type Entry = {
  original: string;
  webp: string;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
  quality: number;
  underTarget: boolean;
};

async function main() {
  ensureDirs();
  const bundle = await build({
    entryPoints: [join(IMPORT_DIR, "../../lib/images/compress.ts")],
    bundle: true,
    format: "iife",
    globalName: "KittoraImages",
    write: false,
    target: "es2022",
  });

  const browser = await launch();
  const page = await newPage(browser, { width: 800, height: 600 });
  await page.setContent("<!doctype html><title>compress</title>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const files = readdirSync(ORIGINALS_DIR).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)).sort();
  const manifest: Entry[] = [];
  for (const file of files) {
    const buf = readFileSync(join(ORIGINALS_DIR, file));
    const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" }[
      extname(file).toLowerCase()
    ]!;
    const out = await page.evaluate(
      async ({ b64, mime }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib = (globalThis as any).KittoraImages as typeof import("../../lib/images/compress");
        const r = await lib.compressImage(new Blob([bytes], { type: mime }));
        const data = new Uint8Array(await r.blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
        return { b64: btoa(bin), width: r.width, height: r.height, quality: r.quality, underTarget: r.underTarget, type: r.blob.type };
      },
      { b64: buf.toString("base64"), mime },
    );
    const webpName = basename(file, extname(file)) + ".webp";
    const webp = Buffer.from(out.b64, "base64");
    writeFileSync(join(WEBP_DIR, webpName), webp);
    manifest.push({
      original: file,
      webp: webpName,
      originalBytes: buf.length,
      bytes: webp.length,
      width: out.width,
      height: out.height,
      quality: out.quality,
      underTarget: out.underTarget,
    });
    console.log(
      `${file.padEnd(62)} ${(buf.length / 1024).toFixed(0).padStart(4)} KB → ${(webp.length / 1024).toFixed(0).padStart(4)} KB  ${out.width}×${out.height} q${out.quality}${out.underTarget ? "" : "  ⚠ over target"}`,
    );
  }
  await browser.close();
  writeFileSync(join(WEBP_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const over = manifest.filter((m) => !m.underTarget);
  console.log(`\n${manifest.length} images compressed; ${over.length} over the 250 KB target.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
