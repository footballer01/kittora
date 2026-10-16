import type { Metadata } from "next";
import { WishlistView } from "@/components/store/wishlist-view";
import { getCatalog } from "@/lib/catalog/source";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: true } };

export default function WishlistPage() {
  return <WishlistView catalog={getCatalog()} />;
}
