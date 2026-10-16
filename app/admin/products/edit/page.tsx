import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Edit product" };

export default function Page() {
  return (
    <Suspense>
      <ProductEditor />
    </Suspense>
  );
}
