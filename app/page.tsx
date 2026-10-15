import type { Metadata } from "next";
import { HomeView } from "@/components/store/home-view";
import { getCatalog, getEdits } from "@/lib/catalog/source";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <HomeView catalog={getCatalog()} edits={getEdits()} />;
}
