import type { Metadata } from "next";
import { HomeView } from "@/components/store/home-view";
import { getPreviewCatalog, getPreviewEdits, previewHref } from "@/lib/preview/sample";
import { SampleBanner } from "./sample-banner";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default function PreviewHome() {
  const catalog = getPreviewCatalog();
  return (
    <>
      <SampleBanner />
      <HomeView catalog={catalog} edits={getPreviewEdits(catalog)} href={previewHref} sample />
    </>
  );
}
