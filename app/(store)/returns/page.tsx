import type { Metadata } from "next";
import { PolicyView } from "@/components/store/policy-view";

export const metadata: Metadata = { title: "Returns & exchanges", alternates: { canonical: "/returns" } };

export default function Page() {
  return <PolicyView policy="returns" title="Returns & exchanges" />;
}
