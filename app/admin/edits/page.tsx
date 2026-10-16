import type { Metadata } from "next";
import { Suspense } from "react";
import { EditsView } from "@/components/admin/edits-view";

export const metadata: Metadata = { title: "Edits" };

export default function Page() {
  return (
    <Suspense>
      <EditsView />
    </Suspense>
  );
}
