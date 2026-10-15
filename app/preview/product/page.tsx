import type { Metadata } from "next";
import { PreviewProduct } from "./view";

export const metadata: Metadata = { title: "Preview product", robots: { index: false, follow: false } };

// A product with a sample kit story and a back image.
export default function PreviewProductPage() {
  return <PreviewProduct slug="arsenal-red-and-white-saka-7-jersey" />;
}
