import Image from "next/image";
import { visibleCategories, type CategoryCounts } from "@/lib/catalog/categories";
import type { CatalogImage } from "@/lib/catalog/types";
import { ArrowRightIcon } from "@/components/ui/icons";

/** Shop by category — only categories that have jerseys, plus "All jerseys". */
export function CategoryTiles({ counts, images }: { counts: CategoryCounts; images: CatalogImage[] }) {
  const total = Math.max(...Object.values(counts), 0);
  const tiles = [
    ...visibleCategories(counts).map((c) => ({ label: c.label, href: c.href, count: counts[c.key] })),
    { label: "All jerseys", href: "/shop", count: total },
  ];
  return (
    <section aria-labelledby="categories-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <h2 id="categories-title" className="text-step-3 font-bold sm:text-step-4">
        Shop by category
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
        {tiles.map((t, i) => {
          const img = images[i % Math.max(images.length, 1)];
          return (
            <a key={t.href} href={t.href} className="group relative flex min-h-56 items-end overflow-hidden rounded-[var(--radius-card)] bg-surface p-6 sm:min-h-72 sm:p-8">
              {img && (
                <Image
                  src={img.src}
                  alt=""
                  width={img.width}
                  height={img.height}
                  sizes="(min-width: 640px) 300px, 50vw"
                  className="absolute top-1/2 right-[-6%] h-[92%] w-auto sm:right-0 sm:h-[118%] -translate-y-1/2 rotate-[4deg] rounded-xl bg-white object-cover shadow-2xl transition-transform duration-700 ease-out group-hover:rotate-0"
                />
              )}
              <div className="relative z-10 max-w-[55%] sm:max-w-none">
                <p className="font-heading text-step-3 font-bold">{t.label}</p>
                <p className="mt-1 inline-flex items-center gap-2 text-step-n1 text-ink-muted group-hover:text-ink">
                  {t.count} {t.count === 1 ? "jersey" : "jerseys"} <ArrowRightIcon width={16} height={16} />
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
