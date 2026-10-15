import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog/source";
import { PreviewProduct } from "../view";

export const dynamicParams = false;
export const metadata: Metadata = { title: "Preview product", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return getCatalog().map((p) => ({ slug: p.slug }));
}

export default async function Page({ params }: PageProps<"/preview/product/[slug]">) {
  const { slug } = await params;
  return <PreviewProduct slug={slug} />;
}
