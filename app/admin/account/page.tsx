import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/admin/account-view";

export const metadata: Metadata = { title: "Account" };

export default function Page() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
