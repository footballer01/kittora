// Delivery zones CSV: name, pincode prefix, min days, max days, COD (optional).
// A header row is skipped if present. Quoted fields may contain commas.

export type ZoneRow = { name: string; pincode_prefix: string; min_days: number; max_days: number; cod_available: boolean };
export type ZoneParse = { rows: ZoneRow[]; errors: string[] };

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["", "no", "n", "false", "0"]);

export function parseZonesCsv(text: string): ZoneParse {
  const rows: ZoneRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const [name = "", prefix = "", min = "", max = "", cod = ""] = splitLine(raw);
    const lineNo = i + 1;
    if (i === 0 && !/^\d/.test(prefix)) return; // header
    const minDays = Number(min);
    const maxDays = Number(max);
    const codKey = cod.toLowerCase();
    if (!name || name.length > 80) return void errors.push(`Line ${lineNo}: add a zone name`);
    if (!/^\d{1,6}$/.test(prefix)) return void errors.push(`Line ${lineNo}: pincode prefix must be 1–6 digits`);
    if (!Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 0 || maxDays < minDays || maxDays > 60)
      return void errors.push(`Line ${lineNo}: days must be whole numbers, min ≤ max`);
    if (!YES.has(codKey) && !NO.has(codKey)) return void errors.push(`Line ${lineNo}: COD must be yes or no`);
    if (seen.has(prefix)) return void errors.push(`Line ${lineNo}: prefix ${prefix} appears twice`);
    seen.add(prefix);
    rows.push({ name, pincode_prefix: prefix, min_days: minDays, max_days: maxDays, cod_available: YES.has(codKey) });
  });
  return { rows, errors };
}

export function zonesToCsv(rows: ZoneRow[]): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["name,pincode_prefix,min_days,max_days,cod", ...rows.map((r) => [q(r.name), r.pincode_prefix, r.min_days, r.max_days, r.cod_available ? "yes" : "no"].join(","))].join("\n");
}
