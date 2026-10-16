import type { MetadataRoute } from "next";
import { countCategories, visibleCategories } from "@/lib/catalog/categories";
import { groupBy } from "@/lib/catalog/groups";
import { getCatalog } from "@/lib/catalog/source";
import { absolute } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const catalog = getCatalog();
  const page = (path: string, priority: number, images?: string[]) => ({ url: absolute(path), priority, ...(images?.length && { images }) });
  return [
    page("/", 1),
    page("/shop", 0.9),
    ...visibleCategories(countCategories(catalog)).map((c) => page(c.href, 0.8)),
    ...groupBy(catalog, "club").map((g) => page(`/club/${g.slug}`, 0.7)),
    ...groupBy(catalog, "player").map((g) => page(`/player/${g.slug}`, 0.6)),
    ...catalog.map((p) => page(`/product/${p.slug}`, 0.8, p.images.map((i) => absolute(i.src)))),
  ];
}
