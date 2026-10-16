import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: true } };

export default function CartPage() {
  return <CartView />;
}
