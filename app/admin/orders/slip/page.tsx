import type { Metadata } from "next";
import { Suspense } from "react";
import { PackingSlip } from "@/components/admin/packing-slip";

export const metadata: Metadata = { title: "Packing slip" };

export default function Page() {
  return (
    <Suspense>
      <PackingSlip />
    </Suspense>
  );
}
