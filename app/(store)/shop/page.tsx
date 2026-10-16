import type { Metadata } from "next";
import { ShopView } from "@/components/store/shop-view";
import { getCatalog } from "@/lib/catalog/source";

export const metadata: Metadata = {
  title: "Shop all jerseys",
  description: "Every jersey in the archive. Filter by club, player, number and size, and sort by price.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <ShopView products={getCatalog()} eyebrow="The archive" title="All jerseys" />;
}
