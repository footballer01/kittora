import type { Metadata } from "next";
import { PayView } from "@/components/store/pay-view";

export const metadata: Metadata = { title: "Pay for your order", robots: { index: false, follow: false } };

// One static page serves every order: Cloudflare rewrites /order/<number>/pay
// here (public/_redirects, written by scripts/catalog/snapshot.ts) and the
// page reads the number from the URL.
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ number: "_" }];
}

export default function PayPage() {
  return <PayView />;
}
