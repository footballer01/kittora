import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "@/components/admin/orders-view";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
