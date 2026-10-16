import { z } from "zod";

// Product editor form. Postgres re-checks price, number and video limits.

export const KIT_TYPES = ["home", "away", "third", "retro", "special"] as const;
export const AUDIENCES = ["men", "women", "kids"] as const;

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((s) => s || null);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Add a name").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
  club: optionalText(80),
  country: optionalText(80),
  player: optionalText(80),
  number: z
    .string()
    .trim()
    .refine((s) => s === "" || (/^\d{1,2}$/.test(s) && Number(s) <= 99), "0–99, or leave empty")
    .transform((s) => (s === "" ? null : Number(s))),
  season: optionalText(20),
  kit_type: z.enum(["", ...KIT_TYPES]).transform((s) => s || null),
  fit: optionalText(40),
  audience: z.array(z.enum(AUDIENCES)),
  price: z
    .string()
    .trim()
    .refine((s) => /^\d{1,7}(\.\d{1,2})?$/.test(s), "Enter the price in rupees, e.g. 1499")
    .transform((s) => Math.round(Number(s) * 100)),
  description: optionalText(4000),
  story_title: optionalText(120),
  story: optionalText(4000),
  published: z.boolean(),
  featured: z.boolean(),
  featured_position: z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d{1,3}$/.test(s), "A whole number, or leave empty")
    .transform((s) => (s === "" ? null : Number(s))),
  track_stock: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

export const SIZE_PRESET = ["S", "M", "L", "XL", "XXL"];

/** Stock box → number (empty = not set). */
export function parseStock(s: string): number | null | "invalid" {
  const t = s.trim();
  if (t === "") return null;
  return /^\d{1,5}$/.test(t) ? Number(t) : "invalid";
}

export const paiseToRupeesInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
