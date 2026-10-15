import { describe, expect, it } from "vitest";
import { formatPaise, rupeesToPaise } from "@/lib/money";

describe("money", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatPaise(90000)).toBe("₹900");
  });

  it("uses Indian digit grouping", () => {
    expect(formatPaise(12345600)).toBe("₹1,23,456");
  });

  it("keeps paise when present", () => {
    expect(formatPaise(90050)).toBe("₹900.50");
  });

  it("rejects fractional paise", () => {
    expect(() => formatPaise(1.5)).toThrow(TypeError);
  });

  it("converts rupees to paise without float drift", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
  });
});
