// Colour maths for design tokens: sRGB hex ↔ OKLCH, alpha compositing and
// WCAG 2 contrast. Pure functions, no dependencies.

export type RGB = { r: number; g: number; b: number }; // 0–1, gamma-encoded sRGB
export type RGBA = RGB & { a: number };
export type OKLCH = { l: number; c: number; h: number }; // l 0–1, c ≥ 0, h degrees

export function parseHex(hex: string): RGBA {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 || m.length === 4 ? [...m].map((ch) => ch + ch).join("") : m;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) throw new Error(`Invalid hex colour: ${hex}`);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) : 1 };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** HSL triplet as written in shadcn-style CSS variables, e.g. "8 100% 68%". */
export function hslVarToHex(value: string): string {
  const [h, s, l] = value.replace(/%/g, "").trim().split(/[\s,]+/).map(Number);
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex({ r: f(0), g: f(8), b: f(4) });
}

/** Composite a (possibly translucent) colour over an opaque background. */
export function composite(fg: string, bg: string): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio between two opaque colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function hexToOklch(hex: string): OKLCH {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToLinear({ l, c, h }: OKLCH): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

export function inGamut(color: OKLCH): boolean {
  return oklchToLinear(color).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** OKLCH → hex. Out-of-gamut colours keep L and h and lose chroma until they fit. */
export function oklchToHex(color: OKLCH): string {
  let c = color.c;
  if (!inGamut({ ...color, c })) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut({ ...color, c: mid })) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  const [r, g, b] = oklchToLinear({ ...color, c });
  return toHex({ r: toGamma(Math.max(0, r)), g: toGamma(Math.max(0, g)), b: toGamma(Math.max(0, b)) });
}

export function formatOklch({ l, c, h }: OKLCH): string {
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
}

/** Same hue and chroma, new lightness. */
export function withLightness(hex: string, l: number): string {
  return oklchToHex({ ...hexToOklch(hex), l: Math.min(1, Math.max(0, l)) });
}

/**
 * Smallest OKLCH lightness change to `hex` (hue and chroma kept) that reaches
 * `target` contrast against `against`. Tries lighter and darker; returns the
 * nearer passing value, or null if neither direction can pass.
 */
export function minimalLightnessFix(
  hex: string,
  against: string,
  target: number,
): { hex: string; deltaL: number; ratio: number } | null {
  const base = hexToOklch(hex);
  if (contrast(hex, against) >= target) return { hex, deltaL: 0, ratio: contrast(hex, against) };
  const candidates: { hex: string; deltaL: number; ratio: number }[] = [];
  for (const dir of [1, -1]) {
    for (let step = 1; step <= 1000; step++) {
      const l = base.l + (dir * step) / 1000;
      if (l < 0 || l > 1) break;
      const candidate = oklchToHex({ ...base, l });
      const ratio = contrast(candidate, against);
      if (ratio >= target) {
        candidates.push({ hex: candidate, deltaL: (dir * step) / 1000, ratio });
        break;
      }
    }
  }
  candidates.sort((a, b) => Math.abs(a.deltaL) - Math.abs(b.deltaL));
  return candidates[0] ?? null;
}
