// SAMPLE CONTENT for /preview only, so back images, kit stories, edits and the
// peg rail can be judged before admins add real data. Never written to the
// database and never used outside /preview.
//
// - Back images: v1 photos show front and back side by side; the preview uses
//   each half (public/fixtures/preview/*-front.jpg / *-back.jpg).
// - Shirt numbers: read from the product names for this preview only. Real
//   numbers are entered by admins.
import { getImportCatalog } from "@/lib/catalog/source";
import type { CatalogEdit, CatalogImage, CatalogProduct, ProductHref } from "@/lib/catalog/types";

export const previewHref: ProductHref = (p) => `/preview/product/${p.slug}`;

const STORIES: Record<string, { title: string; body: string }> = {
  "arsenal-red-and-white-saka-7-jersey": {
    title: "Red body, white sleeves, number 7",
    body: "Arsenal's red with white sleeves is one of the most recognisable looks in English football. This one carries Saka's name and the 7 on the back — a modern chapter hung beside the classics in the archive.",
  },
  "ac-milan-white-kaka-22-jersey": {
    title: "White for the big nights",
    body: "Milan's white change shirt, with Kaká's 22 in red across the back. Clean, bright and understated — the kind of shirt that belongs to floodlit European evenings.",
  },
  "argentina-sky-blue-and-white-striped-jersey": {
    title: "Sky blue and white",
    body: "The stripes of the Albiceleste need no introduction. Simple, bold and instantly recognisable on any terrace in the world.",
  },
};

const EDITS: { slug: string; title: string; description: string; club: string }[] = [
  { slug: "blaugrana", title: "Blaugrana", description: "Barcelona's blue and garnet, from Messi to Yamal.", club: "FC Barcelona" },
  { slug: "theatre-of-dreams", title: "Theatre of Dreams", description: "Manchester United's reds and blacks, worn by Ronaldo and Beckham.", club: "Manchester United" },
];

function crop(slug: string, side: "front" | "back", alt: string): CatalogImage {
  return { src: `/fixtures/preview/${slug}-${side}.jpg`, width: side === "front" ? 299 : 300, height: 392, alt: `${alt} — ${side}` };
}

export function getPreviewCatalog(): CatalogProduct[] {
  return getImportCatalog().map((p) => {
    const alt = p.image?.alt ?? p.name;
    const front = crop(p.slug, "front", alt);
    const back = crop(p.slug, "back", alt);
    const number = Number(/#(\d{1,2})\b/.exec(p.name)?.[1] ?? NaN);
    return {
      ...p,
      number: Number.isFinite(number) ? number : null,
      image: front,
      backImage: back,
      images: [front, back, ...(p.image ? [p.image] : [])],
      story: STORIES[p.slug] ? { ...STORIES[p.slug] } : null,
    };
  });
}

export function getPreviewEdits(catalog: CatalogProduct[]): CatalogEdit[] {
  return EDITS.map((e) => ({
    slug: e.slug,
    title: e.title,
    description: e.description,
    productIds: catalog.filter((p) => p.club === e.club).map((p) => p.id),
  }));
}
