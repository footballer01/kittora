import Image from "next/image";
import Link from "next/link";
import { defaultHref, type CatalogEdit, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { TruckIcon, ReturnIcon } from "@/components/ui/icons";
import { BuyBox } from "./buy-box";
import { EditRail } from "./edit-rail";
import { SampleBadge } from "./peg-rail";
import { Price } from "./price";
import { ProductGallery } from "./product-gallery";

/**
 * Product page: scrolling gallery beside a sticky info column (desktop),
 * swipe gallery with a sticky Add to cart bar (mobile). Kit story and
 * "From the same edit" appear only when they exist.
 */
export function ProductView({
  product,
  catalog,
  edits,
  href = defaultHref,
  sample = false,
}: {
  product: CatalogProduct;
  catalog: CatalogProduct[];
  edits: CatalogEdit[];
  href?: ProductHref;
  sample?: boolean;
}) {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const sameEdits = edits.filter((e) => e.productIds.includes(product.id));
  const audience = product.audience[0];
  const storyImage = product.backImage ?? product.image;

  return (
    <main className="pb-28 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        <nav aria-label="Breadcrumb" className="text-step-n1 text-ink-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            {audience && (
              <li className="before:mr-2 before:content-['/']">
                <a href={`/category/${audience}`} className="capitalize hover:text-ink">
                  {audience}
                </a>
              </li>
            )}
            <li aria-current="page" className="truncate text-ink before:mr-2 before:text-ink-muted before:content-['/']">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <ProductGallery images={product.images} video={product.video} name={product.name} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.club && <p className="text-step-n1 text-ink-muted">{product.club}</p>}
            <h1 className="mt-2 font-heading text-step-4 leading-[1.05] font-bold tracking-[-0.025em]">{product.name}</h1>
            <div className="mt-4 flex items-baseline gap-4">
              <Price paise={product.pricePaise} tone="brand" className="text-step-2" />
              {product.sku && <span className="font-mono text-step-n2 text-ink-muted">{product.sku}</span>}
            </div>
            <p className="mt-1 text-step-n2 text-ink-muted">Inclusive of all taxes</p>

            <div className="mt-8">
              <BuyBox product={product} />
            </div>

            <ul className="mt-8 grid gap-3 text-step-n1 text-ink-muted">
              <li className="flex items-center gap-3">
                <TruckIcon className="shrink-0 text-ink" width={20} height={20} /> Delivered across India, tracked end to end
              </li>
              <li className="flex items-center gap-3">
                <ReturnIcon className="shrink-0 text-ink" width={20} height={20} /> Seven-day returns on unworn jerseys
              </li>
            </ul>

            <div className="mt-8 divide-y divide-line border-y border-line">
              {product.description && (
                <details open className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-medium">
                    Description <span className="text-ink-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-5 text-ink-muted">{product.description}</p>
                </details>
              )}
              <details className="group py-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-medium">
                  Delivery &amp; returns <span className="text-ink-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 text-ink-muted">
                  Secure shipping to your doorstep, tracked end to end. Return unworn jerseys within seven days of delivery.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>

      {product.story && (
        <section id="story" aria-labelledby="story-title" className="mx-auto mt-16 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:mt-28 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
            {storyImage && (
              <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-white lg:order-last">
                <Image src={storyImage.src} alt="" width={storyImage.width} height={storyImage.height} sizes="(min-width: 1024px) 560px, 92vw" className="size-full object-cover" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <p className="text-step-n1 font-medium text-ink-muted">Kit story</p>
                {sample && <SampleBadge>Sample story</SampleBadge>}
              </div>
              <h2 id="story-title" className="mt-3 text-step-4 font-bold">
                {product.story.title ?? product.name}
              </h2>
              <p className="mt-5 max-w-[62ch] text-step-1 leading-relaxed text-ink-muted">{product.story.body}</p>
            </div>
          </div>
        </section>
      )}

      {sameEdits.map((e) => (
        <EditRail
          key={e.slug}
          edit={e}
          eyebrow="From the same edit"
          products={e.productIds.filter((id) => id !== product.id).map((id) => byId.get(id)).filter((p): p is CatalogProduct => !!p)}
          href={href}
          sample={sample}
        />
      ))}
    </main>
  );
}
