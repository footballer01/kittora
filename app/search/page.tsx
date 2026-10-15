import type { Metadata } from "next";
import { ShopView } from "@/components/store/shop-view";
import { getCatalog } from "@/lib/catalog/source";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default function SearchPage() {
  return <ShopView products={getCatalog()} title="Search" searchFirst />;
}
