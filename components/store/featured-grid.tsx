import { defaultHref, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { ArrowRightIcon } from "@/components/ui/icons";
import { ProductCard } from "./product-card";

export function FeaturedGrid({ products, title = "Featured jerseys", href = defaultHref }: { products: CatalogProduct[]; title?: string; href?: ProductHref }) {
  return (
    <section aria-labelledby="featured-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-step-n1 font-medium text-ink-muted">Curated</p>
          <h2 id="featured-title" className="mt-1 text-step-3 font-bold sm:text-step-4">
            {title}
          </h2>
        </div>
        <a href="/shop" className="inline-flex min-h-11 items-center gap-1.5 text-step-n1 font-semibold text-ink hover:text-brand-text">
          View all <ArrowRightIcon width={16} height={16} />
        </a>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} href={href} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}
