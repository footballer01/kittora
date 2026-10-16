// Absolute URLs and structured data for search engines.
import type { CatalogProduct } from "./catalog/types";

export const SITE_NAME = "Terrace Archive";
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const absolute = (path: string) => `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absolute(c.path) })),
  };
}

/**
 * Product structured data from stored fields only. Availability reflects
 * build-time stock: unknown stock (null) counts as in stock, as on v1.
 */
export function productJsonLd(p: CatalogProduct) {
  const soldOut = p.variants.length > 0 && p.variants.every((v) => v.stock === 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url: absolute(`/product/${p.slug}`),
    ...(p.sku && { sku: p.sku }),
    ...(p.description && { description: p.description }),
    image: p.images.map((i) => absolute(i.src)),
    ...(p.club && { category: `Football jerseys > ${p.club}` }),
    offers: {
      "@type": "Offer",
      url: absolute(`/product/${p.slug}`),
      priceCurrency: "INR",
      price: (p.pricePaise / 100).toFixed(2),
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

/** Safe inline JSON-LD (escapes "<" so no value can close the script tag). */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
