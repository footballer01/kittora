// Runs Lighthouse (mobile) on a list of URLs and prints JSON results.
// Plain Node on purpose: tsx rewrites functions Lighthouse sends to the browser.
//   node scripts/import/lighthouse-run.mjs <chromePath> <outDir> <key=url>...
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const [chromePath, outDir, ...pairs] = process.argv.slice(2);
const RUNS = 3;
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox"] });
const results = [];
try {
  for (const pair of pairs) {
    const [key, url] = pair.split(/=(.*)/s);
    // 3 runs per page; errored runs are skipped; the median-performance run is kept.
    const runs = [];
    for (let i = 0; i < RUNS + 2 && runs.length < RUNS; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      console.error(`→ Lighthouse ${url} (run ${i + 1})`);
      const run = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error" });
      if (run.lhr.runtimeError) {
        console.error(`  skipped: ${run.lhr.runtimeError.code}`);
        continue;
      }
      runs.push(run);
    }
    if (runs.length === 0) {
      results.push({ page: key, url, error: "All Lighthouse runs failed" });
      continue;
    }
    runs.sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score);
    const run = runs[Math.floor(runs.length / 2)];
    const lhr = run.lhr;
    writeFileSync(join(outDir, `${key}.json`), run.report);
    const items = lhr.audits["resource-summary"]?.details?.items ?? [];
    const script = items.find((r) => r.resourceType === "script");
    const total = items.find((r) => r.resourceType === "total");
    const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
    results.push({
      page: key,
      url,
      formFactor: lhr.configSettings.formFactor,
      runs: runs.length,
      performanceRange: [runs[0].lhr.categories.performance.score, runs.at(-1).lhr.categories.performance.score].map((v) => Math.round(v * 100)),
      lighthouseVersion: lhr.lighthouseVersion,
      scores: { performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), seo: score("seo") },
      metrics: {
        lcpMs: Math.round(lhr.audits["largest-contentful-paint"]?.numericValue ?? 0),
        cls: Number((lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
        fcpMs: Math.round(lhr.audits["first-contentful-paint"]?.numericValue ?? 0),
        tbtMs: Math.round(lhr.audits["total-blocking-time"]?.numericValue ?? 0),
        speedIndexMs: Math.round(lhr.audits["speed-index"]?.numericValue ?? 0),
      },
      weight: {
        jsTransferKB: Math.round((script?.transferSize ?? 0) / 1024),
        jsRequests: script?.requestCount ?? 0,
        totalTransferKB: Math.round((total?.transferSize ?? 0) / 1024),
        totalRequests: total?.requestCount ?? 0,
      },
      failedAudits: Object.values(lhr.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && !["informative", "manual", "notApplicable"].includes(a.scoreDisplayMode))
        .map((a) => ({ id: a.id, title: a.title, score: a.score, displayValue: a.displayValue ?? null }))
        .slice(0, 25),
    });
  }
} finally {
  chrome.kill();
}
process.stdout.write(JSON.stringify(results));
