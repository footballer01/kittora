import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/store/shop-view";
import { CATEGORIES, countCategories, visibleCategories } from "@/lib/catalog/categories";
import { getCatalog } from "@/lib/catalog/source";

export const dynamicParams = false;

// Empty categories are not built at all, so their URLs 404.
export function generateStaticParams() {
  return visibleCategories(countCategories(getCatalog())).map((c) => ({ audience: c.key }));
}

const category = (key: string) => CATEGORIES.find((c) => c.key === key);

export async function generateMetadata({ params }: PageProps<"/category/[audience]">): Promise<Metadata> {
  const c = category((await params).audience);
  if (!c) return {};
  return { title: `${c.label}'s jerseys`, description: `Football jerseys for ${c.label.toLowerCase()}, delivered across India.`, alternates: { canonical: c.href } };
}

export default async function CategoryPage({ params }: PageProps<"/category/[audience]">) {
  const c = category((await params).audience);
  if (!c) notFound();
  const products = getCatalog().filter((p) => p.audience.includes(c.key));
  return <ShopView products={products} eyebrow="Category" title={c.label} hide={["audience"]} />;
}
