import type { Metadata } from "next";
import { PolicyView } from "@/components/store/policy-view";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Page() {
  return <PolicyView policy="privacy" title="Privacy" />;
}
