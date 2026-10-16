import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/preview", "/search", "/wishlist", "/cart", "/checkout", "/order/"] },
    sitemap: absolute("/sitemap.xml"),
  };
}
