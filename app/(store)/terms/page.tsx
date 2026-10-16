import type { Metadata } from "next";
import { PolicyView } from "@/components/store/policy-view";

export const metadata: Metadata = { title: "Terms of sale", alternates: { canonical: "/terms" } };

export default function Page() {
  return <PolicyView policy="terms" title="Terms of sale" />;
}
