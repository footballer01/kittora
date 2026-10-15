import Image from "next/image";
import { defaultHref, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SampleBadge } from "./peg-rail";

/** "From the Archive": 2–3 kit stories linking to their shirts. Hidden when there are none. */
export function ArchiveStrip({ products, href = defaultHref, sample = false }: { products: CatalogProduct[]; href?: ProductHref; sample?: boolean }) {
  const stories = products.filter((p) => p.story).slice(0, 3);
  if (stories.length < 2) return null;
  return (
    <section aria-labelledby="archive-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-step-n1 font-medium text-ink-muted">Kit stories</p>
          <h2 id="archive-title" className="mt-1 text-step-3 font-bold sm:text-step-4">
            From the Archive
          </h2>
        </div>
        {sample && <SampleBadge>Sample stories</SampleBadge>}
      </div>
      <div className="mt-8 grid gap-12 md:grid-cols-3 md:gap-8">
        {stories.map((p) => (
          <article key={p.id} className="group relative" data-vt-root>
            <div data-vt-img className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-white">
              {(p.backImage ?? p.image) && (
                <Image
                  src={(p.backImage ?? p.image)!.src}
                  alt=""
                  width={(p.backImage ?? p.image)!.width}
                  height={(p.backImage ?? p.image)!.height}
                  sizes="(min-width: 768px) 400px, 92vw"
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              )}
            </div>
            <p className="mt-5 text-step-n1 text-ink-muted">{p.club}</p>
            <h3 className="mt-1 font-heading text-step-1 font-semibold">
              <a href={`${href(p)}#story`} data-vt className="after:absolute after:inset-0 after:content-['']">
                {p.story!.title ?? p.name}
              </a>
            </h3>
            <p className="mt-2 line-clamp-3 max-w-[60ch] text-ink-muted">{p.story!.body}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-step-n1 font-semibold text-ink group-hover:text-brand-text">
              Read the story <ArrowRightIcon width={16} height={16} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
