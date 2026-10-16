// Builds public/pincodes/<first two digits>.json from India Post's All India
// Pincode Directory (data.gov.in, Government Open Data License – India).
// Checkout fetches one small file to autofill city and state; shoppers can
// always type them by hand. Re-run when the directory changes:
//
//   curl -fsSLo /tmp/pincode.csv https://raw.githubusercontent.com/dropdevrahul/pincodes-india/main/pincode.csv
//   npx tsx scripts/pincodes/build.ts /tmp/pincode.csv
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public/pincodes");
const SMALL = new Set(["and", "of"]);

const title = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[a-z]+/g, (w, i) => (i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)));

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/pincodes/build.ts <pincode.csv>");
  process.exit(2);
}
const [header, ...lines] = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
const cols = parseLine(header);
const [iPin, iDistrict, iState] = ["Pincode", "District", "StateName"].map((c) => cols.indexOf(c));
if ([iPin, iDistrict, iState].includes(-1)) throw new Error(`Unexpected columns: ${cols.join(", ")}`);

// Several post offices share a pincode; keep the district most of them name.
const votes = new Map<string, Map<string, number>>();
for (const line of lines) {
  const row = parseLine(line);
  const pin = row[iPin]?.trim();
  if (!/^[1-9]\d{5}$/.test(pin) || !row[iDistrict] || !row[iState]) continue;
  const key = `${title(row[iDistrict])}|${title(row[iState])}`;
  const m = votes.get(pin) ?? new Map<string, number>();
  m.set(key, (m.get(key) ?? 0) + 1);
  votes.set(pin, m);
}

const groups = new Map<string, Record<string, [string, string]>>();
for (const [pin, m] of [...votes].sort(([a], [b]) => a.localeCompare(b))) {
  const [district, state] = [...m].sort((a, b) => b[1] - a[1])[0][0].split("|");
  const g = groups.get(pin.slice(0, 2)) ?? {};
  g[pin.slice(2)] = [district, state];
  groups.set(pin.slice(0, 2), g);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [prefix, g] of groups) writeFileSync(join(OUT, `${prefix}.json`), JSON.stringify(g));
console.log(`${votes.size} pincodes in ${groups.size} files`);
