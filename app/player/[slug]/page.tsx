import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/store/shop-view";
import { groupBy, staticParams } from "@/lib/catalog/groups";
import { getCatalog } from "@/lib/catalog/source";
import { breadcrumbJsonLd, jsonLd } from "@/lib/seo";

export const dynamicParams = false;

// Players come only from the admin-filled `player` field, never from names.
const players = () => groupBy(getCatalog(), "player");
export const generateStaticParams = () => staticParams(players());

export async function generateMetadata({ params }: PageProps<"/player/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const player = players().find((g) => g.slug === slug);
  if (!player) return { robots: { index: false } };
  const image = player.products.find((p) => p.image)?.image;
  return {
    title: `${player.name} jerseys`,
    description: `${player.name} jerseys in the archive, delivered across India.`,
    alternates: { canonical: `/player/${player.slug}` },
    openGraph: image ? { images: [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] } : undefined,
  };
}

export default async function PlayerPage({ params }: PageProps<"/player/[slug]">) {
  const { slug } = await params;
  const player = players().find((g) => g.slug === slug);
  if (!player) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: player.name, path: `/player/${player.slug}` },
          ]),
        )}
      />
      <ShopView products={player.products} eyebrow="Player" title={player.name} hide={["player"]} />
    </>
  );
}
