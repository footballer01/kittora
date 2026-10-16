import type { Metadata } from "next";
import { Suspense } from "react";
import { ZonesView } from "@/components/admin/zones-view";

export const metadata: Metadata = { title: "Delivery zones" };

export default function Page() {
  return (
    <Suspense>
      <ZonesView />
    </Suspense>
  );
}
