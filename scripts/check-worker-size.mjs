// Fails when the compressed worker upload exceeds the budget.
// Cloudflare's free plan rejects workers over 3 MiB (gzip); we stop at 2.8 MiB.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUDGET_KIB = 2.8 * 1024;
const outdir = mkdtempSync(join(tmpdir(), "kittora-worker-"));
const out = execFileSync("npx", ["wrangler", "deploy", "--dry-run", "--outdir", outdir], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

const match = out.match(/gzip:\s*([\d.]+)\s*KiB/);
if (!match) {
  console.error(out);
  throw new Error("Could not read gzip size from wrangler output");
}
const gzipKiB = Number(match[1]);
const line = `Worker size: ${gzipKiB.toFixed(1)} KiB gzip (budget ${BUDGET_KIB.toFixed(0)} KiB, hard limit 3072 KiB)`;
if (gzipKiB > BUDGET_KIB) {
  console.error(`✗ ${line}`);
  process.exit(1);
}
console.log(`✓ ${line}`);
