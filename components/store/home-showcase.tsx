import { homeShowcase } from "@/lib/catalog/peg-rail";
import type { CatalogProduct } from "@/lib/catalog/types";
import { FeaturedGrid } from "./featured-grid";
import { PegRail } from "./peg-rail";

/** Peg rail once 4+ jerseys have a shirt number; v1's featured grid until then. */
export function HomeShowcase({ products }: { products: CatalogProduct[] }) {
  const show = homeShowcase(products);
  return show.kind === "rail" ? <PegRail products={show.products} /> : <FeaturedGrid products={show.products} />;
}
