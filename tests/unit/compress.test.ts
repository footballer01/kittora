import { describe, expect, it } from "vitest";
import { encodeUnderTarget, fitWithin, MAX_EDGE, TARGET_BYTES } from "@/lib/images/compress";

describe("fitWithin", () => {
  it("scales a large landscape image to the max edge", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_EDGE, height: 1200 });
  });

  it("scales a large portrait image by its height", () => {
    expect(fitWithin(2000, 3200)).toEqual({ width: 1000, height: MAX_EDGE });
  });

  it("never upscales small images", () => {
    expect(fitWithin(600, 393)).toEqual({ width: 600, height: 393 });
  });

  it("keeps at least one pixel on extreme aspect ratios", () => {
    expect(fitWithin(100_000, 10)).toEqual({ width: MAX_EDGE, height: 1 });
  });

  it("rejects empty sizes", () => {
    expect(() => fitWithin(0, 100)).toThrow(RangeError);
  });
});

describe("encodeUnderTarget", () => {
  // Fake encoder: size shrinks linearly with quality.
  const fake = (bytesAtFull: number) => async (q: number) => ({ size: Math.round(bytesAtFull * q), q });

  it("uses the highest quality that fits", async () => {
    const r = await encodeUnderTarget(fake(300 * 1024), TARGET_BYTES, [0.9, 0.8, 0.7]);
    expect(r.quality).toBe(0.8);
    expect(r.underTarget).toBe(true);
  });

  it("stops at the first quality when it already fits", async () => {
    const calls: number[] = [];
    await encodeUnderTarget(async (q) => (calls.push(q), { size: 10 }), TARGET_BYTES, [0.9, 0.8]);
    expect(calls).toEqual([0.9]);
  });

  it("returns the smallest attempt when nothing fits", async () => {
    const r = await encodeUnderTarget(fake(10_000 * 1024), TARGET_BYTES, [0.9, 0.5]);
    expect(r.quality).toBe(0.5);
    expect(r.underTarget).toBe(false);
  });

  it("propagates encoder errors (e.g. no WebP support)", async () => {
    await expect(encodeUnderTarget(async () => Promise.reject(new Error("no webp")))).rejects.toThrow("no webp");
  });
});
