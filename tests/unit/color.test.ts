import { describe, expect, it } from "vitest";
import {
  composite,
  contrast,
  hexToOklch,
  hslVarToHex,
  minimalLightnessFix,
  oklchToHex,
  parseHex,
  withLightness,
} from "@/lib/color";

describe("hex parsing", () => {
  it("reads 3, 6 and 8 digit hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseHex("#000000").a).toBe(1);
    expect(parseHex("#ffffff80").a).toBeCloseTo(0.502, 3);
  });

  it("rejects junk", () => {
    expect(() => parseHex("coral")).toThrow();
  });
});

describe("hslVarToHex", () => {
  it("converts shadcn-style HSL variables", () => {
    expect(hslVarToHex("0 0% 100%")).toBe("#ffffff");
    expect(hslVarToHex("240 10% 4%")).toBe("#09090b");
    expect(hslVarToHex("8 100% 68%")).toBe("#ff725c");
  });
});

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });

  it("is symmetric", () => {
    expect(contrast("#ff725c", "#09090b")).toBeCloseTo(contrast("#09090b", "#ff725c"), 10);
  });
});

describe("composite", () => {
  it("blends alpha over a background", () => {
    expect(composite("#ffffff80", "#000000")).toBe("#808080");
    expect(composite("#123456", "#ffffff")).toBe("#123456");
  });
});

describe("OKLCH", () => {
  it("round-trips sRGB colours", () => {
    for (const hex of ["#ff725c", "#09090b", "#87aae1", "#f2f2f2", "#15803d"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("puts white at L=1 with no chroma", () => {
    const w = hexToOklch("#ffffff");
    expect(w.l).toBeCloseTo(1, 4);
    expect(w.c).toBeCloseTo(0, 4);
  });

  it("changes lightness only", () => {
    const base = hexToOklch("#ff725c");
    const darker = hexToOklch(withLightness("#ff725c", base.l - 0.1));
    expect(darker.l).toBeCloseTo(base.l - 0.1, 2);
    expect(darker.h).toBeCloseTo(base.h, 0);
  });

  it("clips out-of-gamut colours by reducing chroma", () => {
    expect(oklchToHex({ l: 0.7, c: 0.5, h: 30 })).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("minimalLightnessFix", () => {
  it("returns the colour unchanged when it already passes", () => {
    expect(minimalLightnessFix("#000000", "#ffffff", 4.5)).toMatchObject({ hex: "#000000", deltaL: 0 });
  });

  it("finds the nearest passing lightness", () => {
    const fix = minimalLightnessFix("#ff725c", "#ffffff", 4.5)!;
    expect(fix.ratio).toBeGreaterThanOrEqual(4.5);
    expect(fix.deltaL).toBeLessThan(0);
    expect(contrast(fix.hex, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
