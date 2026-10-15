import { ImageResponse } from "next/og";

// Default share card for pages without their own photo (product, club and
// player pages use the jersey photo instead). Rendered once at build time.
export const dynamic = "force-static";
export const alt = "Terrace Archive — football jerseys, delivered across India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#09090b", color: "#fafafa" }}>
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 6, color: "#ff725c" }}>KITTORA</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>Wear the heritage.</div>
          <div style={{ marginTop: 28, fontSize: 36, color: "#a1a1aa" }}>Football jerseys, curated and delivered across India.</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>Terrace Archive</div>
      </div>
    ),
    size,
  );
}
