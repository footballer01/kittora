import type { ReactNode } from "react";
import Image from "next/image";
import { defaultHref, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { Price } from "./price";

const STAGGER_MS = 300;
const MAX_DELAY_MS = 1500;

/**
 * The Kit Room peg rail — KITTORA's signature moment. A light "wall" band
 * (v1's light footer colours) where shirts hang on pegs under big condensed
 * squad numbers. Native horizontal swipe with snap; numbers drift with scroll
 * where supported; shirts lift on hover.
 */
export function PegRail({
  products,
  title = "Browse by number",
  href = defaultHref,
  sample = false,
}: {
  products: CatalogProduct[];
  title?: string;
  href?: ProductHref;
  sample?: boolean;
}) {
  return (
    <section data-theme="light" aria-labelledby="peg-rail-title" className="relative py-12 sm:py-16 lg:py-20">
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-step-n1 font-medium text-ink-muted">The kit room</p>
          <h2 id="peg-rail-title" className="mt-1 text-step-3 font-bold sm:text-step-4">
            {title}
          </h2>
        </div>
        {sample && <SampleBadge>Sample numbers</SampleBadge>}
      </div>
      <ul className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-6 sm:gap-10 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        {products.map((p, i) => (
          <li key={p.id} className="group relative w-[64vw] max-w-[250px] shrink-0 snap-start sm:w-[230px]" data-vt-root>
            <span aria-hidden className="shirt-number rail-parallax pointer-events-none absolute inset-x-0 top-0 block text-center text-[clamp(7.5rem,24vw,12.5rem)]">
              {p.number}
            </span>
            <div className="relative pt-[clamp(6.5rem,20vw,9.75rem)]">
              {/* Rail and peg */}
              <span aria-hidden className="absolute inset-x-[-1.6rem] top-[clamp(6.5rem,20vw,9.75rem)] h-1 -translate-y-1/2 bg-[#c9c9cc] sm:inset-x-[-2.6rem]" />
              <span aria-hidden className="absolute top-[clamp(6.5rem,20vw,9.75rem)] left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8d8d92] shadow-[inset_0_-2px_2px_rgb(0_0_0/0.25)]" />
              <div className="animate-hang origin-top" style={{ animationDelay: `${Math.min(i * STAGGER_MS, MAX_DELAY_MS)}ms` }}>
                <div className="relative mx-auto mt-1 w-[86%] transition-transform duration-500 ease-out group-hover:-translate-y-2">
                  {/* Soft cast shadow on the wall */}
                  <span aria-hidden className="absolute inset-x-[12%] bottom-[2%] h-[14%] rounded-[50%] bg-black/30 blur-2xl transition-opacity duration-500 group-hover:opacity-60" />
                  {p.image && (
                    <div data-vt-img className="relative">
                      <Image
                        src={p.image.src}
                        alt={p.image.alt}
                        width={p.image.width}
                        height={p.image.height}
                        sizes="230px"
                        className="relative w-full mix-blend-multiply"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 text-center">
              <h3 className="font-heading text-[1rem] leading-snug font-semibold text-ink">
                <a href={href(p)} data-vt className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-focus">
                  {p.player ?? p.name}
                  <span className="sr-only">, number {p.number}</span>
                </a>
              </h3>
              <p className="mt-0.5 text-step-n1 text-ink-muted">
                {p.club} · <Price paise={p.pricePaise} className="text-step-n1 font-medium" />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SampleBadge({ children = "Sample" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-line-strong px-2.5 py-1 font-mono text-[0.7rem] font-semibold text-ink-muted">
      {children}
    </span>
  );
}
