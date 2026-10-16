import type { Metadata } from "next";
import { PolicyView } from "@/components/store/policy-view";

export const metadata: Metadata = { title: "Shipping", alternates: { canonical: "/shipping" } };

export default function Page() {
  return <PolicyView policy="shipping" title="Shipping" />;
}
