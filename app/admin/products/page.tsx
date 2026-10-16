import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsView } from "@/components/admin/products-view";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return (
    <Suspense>
      <ProductsView />
    </Suspense>
  );
}
