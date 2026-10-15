import type { CatalogEdit, CatalogProduct, ProductHref } from "@/lib/catalog/types";
import { defaultHref } from "@/lib/catalog/types";
import { ProductCard } from "./product-card";
import { SampleBadge } from "./peg-rail";

/** A curated edit as a named, swipeable row. */
export function EditRail({
  edit,
  products,
  href = defaultHref,
  eyebrow = "The edit",
  sample = false,
}: {
  edit: CatalogEdit;
  products: CatalogProduct[];
  href?: ProductHref;
  eyebrow?: string;
  sample?: boolean;
}) {
  if (products.length === 0) return null;
  const id = `edit-${edit.slug}`;
  return (
    <section aria-labelledby={id} className="py-10 sm:py-14">
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[60ch]">
          <p className="text-step-n1 font-medium text-ink-muted">{eyebrow}</p>
          <h2 id={id} className="mt-1 text-step-3 font-bold">
            {edit.title}
          </h2>
          {edit.description && <p className="mt-2 text-ink-muted">{edit.description}</p>}
        </div>
        {sample && <SampleBadge>Sample edit</SampleBadge>}
      </div>
      <ul className="no-scrollbar mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 sm:gap-6 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        {products.map((p) => (
          <li key={p.id} className="w-[44vw] max-w-[280px] shrink-0 snap-start sm:w-[260px]">
            <ProductCard product={p} href={href} />
          </li>
        ))}
      </ul>
    </section>
  );
}
