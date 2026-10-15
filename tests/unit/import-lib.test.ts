import { describe, expect, it } from "vitest";
import { fullResolution, slugify, sniffImage } from "@/scripts/import/lib";

describe("fullResolution", () => {
  it("strips Base44 /v1/fill resize segments", () => {
    expect(
      fullResolution(
        "https://media.base44.com/images/public/app/abc_hero.png/v1/fill/w_1440,h_792,al_c,q_90/abc_hero.webp",
      ),
    ).toBe("https://media.base44.com/images/public/app/abc_hero.png");
  });

  it("strips /v1/fit segments", () => {
    expect(fullResolution("https://media.base44.com/images/public/app/logo.png/v1/fit/w_180,h_180/logo.png")).toBe(
      "https://media.base44.com/images/public/app/logo.png",
    );
  });

  it("leaves other URLs alone", () => {
    const u = "https://base44.app/api/apps/x/files/mp/public/x/shirt.jpg";
    expect(fullResolution(u)).toBe(u);
  });
});

describe("slugify", () => {
  it("drops accents, # and punctuation", () => {
    expect(slugify("Real Madrid Green Mbappé #10 Jersey")).toBe("real-madrid-green-mbappe-10-jersey");
  });

  it("spells out ampersands", () => {
    expect(slugify("Arsenal Red & White Saka #7 Jersey")).toBe("arsenal-red-and-white-saka-7-jersey");
  });
});

describe("sniffImage", () => {
  it("reads PNG dimensions", () => {
    const png = new Uint8Array(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 1024);
    new DataView(png.buffer).setUint32(20, 768);
    expect(sniffImage(png)).toEqual({ type: "png", width: 1024, height: 768 });
  });

  it("reads JPEG dimensions from the SOF marker", () => {
    // SOI, APP0 (len 4), SOF0 (len 17): precision 8, height 393, width 600
    const jpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x89, 0x02, 0x58, 0x03,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(sniffImage(jpg)).toEqual({ type: "jpeg", width: 600, height: 393 });
  });

  it("returns null for unknown bytes", () => {
    expect(sniffImage(new Uint8Array(40))).toBeNull();
  });
});
