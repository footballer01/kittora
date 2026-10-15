import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { Price } from "./price";

const STAGGER_MS = 300;
const MAX_DELAY_MS = 1500;

/**
 * Kit Room peg rail: shirts hang under their squad numbers on a rail that
 * scrolls sideways. Only products with a shirt number appear here.
 */
export function PegRail({ products, title = "Browse by number" }: { products: CatalogProduct[]; title?: string }) {
  return (
    <section aria-labelledby="peg-rail-title" className="relative overflow-hidden bg-surface-2 py-10 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="peg-rail-title" className="text-step-2 font-bold sm:text-step-3">
          {title}
        </h2>
      </div>
      <ul className="relative mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-[max(1rem,calc((100vw-80rem)/2+2rem))] pb-4 [scrollbar-width:thin] sm:gap-6">
        {products.map((p, i) => (
          <li key={p.id} className="group relative w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-[240px]">
            <span
              aria-hidden
              className="block text-center font-number text-[clamp(6rem,14vw,10rem)] leading-[0.8] font-black tracking-[-0.03em] text-number transition-colors duration-200 select-none group-hover:text-brand group-focus-within:text-brand"
            >
              {p.number}
            </span>
            {/* The rail and its peg. */}
            <span aria-hidden className="relative block h-5">
              <span className="absolute inset-x-[-1.5rem] top-1/2 h-[3px] -translate-y-1/2 bg-line-strong" />
              <span className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-muted ring-4 ring-surface-2" />
            </span>
            <div
              className="origin-top animate-hang"
              style={{ animationDelay: `${Math.min(i * STAGGER_MS, MAX_DELAY_MS)}ms` }}
            >
              <span aria-hidden className="mx-auto block h-4 w-px bg-ink-muted/60" />
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line transition-transform duration-300 group-hover:-translate-y-1">
                {p.image && (
                  <Image
                    src={p.image.src}
                    alt={p.image.alt}
                    width={p.image.width}
                    height={p.image.height}
                    sizes="260px"
                    className="aspect-[4/3] w-full object-contain p-[6%]"
                  />
                )}
              </div>
              <h3 className="mt-3 font-heading text-[1rem] leading-snug font-semibold">
                <Link href={`/product/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">
                  {p.player ?? p.name}
                  <span className="sr-only">, number {p.number}</span>
                </Link>
              </h3>
              <p className="text-step-n1 text-ink-muted">{p.club}</p>
              <Price paise={p.pricePaise} className="text-step-n1" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
