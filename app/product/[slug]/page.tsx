import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/store/product-view";
import { CATEGORIES } from "@/lib/catalog/categories";
import { getCatalog, getEdits } from "@/lib/catalog/source";
import { breadcrumbJsonLd, jsonLd, productJsonLd, type Crumb } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog().map((p) => ({ slug: p.slug }));
}

const find = (slug: string) => getCatalog().find((p) => p.slug === slug);

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const p = find((await params).slug);
  if (!p) return {};
  const description = p.description ?? `${p.name}${p.club ? ` — ${p.club}` : ""}. Delivered across India.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: {
      type: "website",
      title: p.name,
      description,
      images: p.images.slice(0, 1).map((i) => ({ url: i.src, width: i.width, height: i.height, alt: i.alt })),
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const catalog = getCatalog();
  const { slug } = await params;
  const product = catalog.find((p) => p.slug === slug);
  if (!product) notFound();
  const category = CATEGORIES.find((c) => c.key === product.audience[0]);
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    ...(category ? [{ name: category.label, path: category.href }] : []),
    { name: product.name, path: `/product/${product.slug}` },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([productJsonLd(product), breadcrumbJsonLd(crumbs)])} />
      <ProductView product={product} catalog={catalog} edits={getEdits()} />
    </>
  );
}
