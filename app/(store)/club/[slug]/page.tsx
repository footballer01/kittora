import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/store/shop-view";
import { groupBy, staticParams } from "@/lib/catalog/groups";
import { getCatalog } from "@/lib/catalog/source";
import { breadcrumbJsonLd, jsonLd } from "@/lib/seo";

export const dynamicParams = false;

const clubs = () => groupBy(getCatalog(), "club");
export const generateStaticParams = () => staticParams(clubs());

export async function generateMetadata({ params }: PageProps<"/club/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const club = clubs().find((g) => g.slug === slug);
  if (!club) return {};
  const image = club.products.find((p) => p.image)?.image;
  return {
    title: `${club.name} jerseys`,
    description: `${club.products.length} ${club.name} ${club.products.length === 1 ? "jersey" : "jerseys"} in the archive, delivered across India.`,
    alternates: { canonical: `/club/${club.slug}` },
    openGraph: image ? { images: [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] } : undefined,
  };
}

export default async function ClubPage({ params }: PageProps<"/club/[slug]">) {
  const { slug } = await params;
  const club = clubs().find((g) => g.slug === slug);
  if (!club) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: club.name, path: `/club/${club.slug}` },
          ]),
        )}
      />
      <ShopView products={club.products} eyebrow="Club" title={club.name} hide={["club"]} />
    </>
  );
}
