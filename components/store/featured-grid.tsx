import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { ArrowRightIcon } from "@/components/ui/icons";
import { ProductCard } from "./product-card";

export function FeaturedGrid({ products, title = "Featured jerseys" }: { products: CatalogProduct[]; title?: string }) {
  return (
    <section aria-labelledby="featured-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-step-n1 font-medium text-brand-text">Curated</p>
          <h2 id="featured-title" className="mt-1 text-step-2 font-bold sm:text-step-3">
            {title}
          </h2>
        </div>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-step-n1 font-semibold text-brand-text hover:underline">
          View all <ArrowRightIcon width={16} height={16} />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}
