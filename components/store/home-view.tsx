import { countCategories } from "@/lib/catalog/categories";
import { homeShowcase } from "@/lib/catalog/peg-rail";
import { defaultHref, type CatalogEdit, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { ArchiveStrip } from "./archive-strip";
import { CategoryTiles } from "./category-tiles";
import { EditRail } from "./edit-rail";
import { FeaturedGrid } from "./featured-grid";
import { Hero } from "./hero";
import { PegRail } from "./peg-rail";
import { TrustStrip } from "./trust-strip";

/**
 * Home: hero → peg rail (or featured grid until 4+ shirts have a number) →
 * curated edits → From the Archive → shop by category → trust strip.
 * Every section after the hero hides itself when it has no content.
 */
export function HomeView({
  catalog,
  edits,
  href = defaultHref,
  sample = false,
}: {
  catalog: CatalogProduct[];
  edits: CatalogEdit[];
  href?: ProductHref;
  sample?: boolean;
}) {
  const show = homeShowcase(catalog);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const tileImages = catalog.filter((p) => p.backImage ?? p.image).map((p) => (p.backImage ?? p.image)!);
  return (
    <main>
      <Hero image={{ src: "/fixtures/hero.webp", width: 1024, height: 1024 }} />
      {show.kind === "rail" ? <PegRail products={show.products} href={href} sample={sample} /> : <FeaturedGrid products={show.products} href={href} />}
      {edits.map((e) => (
        <EditRail key={e.slug} edit={e} products={e.productIds.map((id) => byId.get(id)).filter((p): p is CatalogProduct => !!p)} href={href} sample={sample} />
      ))}
      <ArchiveStrip products={catalog} href={href} sample={sample} />
      <CategoryTiles counts={countCategories(catalog)} images={tileImages.slice(4, 6)} />
      <TrustStrip />
    </main>
  );
}
