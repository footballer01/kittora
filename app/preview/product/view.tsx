import { notFound } from "next/navigation";
import { ProductView } from "@/components/store/product-view";
import { getPreviewCatalog, getPreviewEdits, previewHref } from "@/lib/preview/sample";
import { SampleBanner } from "../sample-banner";

export function PreviewProduct({ slug }: { slug: string }) {
  const catalog = getPreviewCatalog();
  const product = catalog.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <>
      <SampleBanner />
      <ProductView product={product} catalog={catalog} edits={getPreviewEdits(catalog)} href={previewHref} sample />
    </>
  );
}
