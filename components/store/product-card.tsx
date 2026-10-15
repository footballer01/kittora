import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { Price } from "./price";

/**
 * v1's photos are wide (front and back side by side), so the frame is 4:3 and
 * the image is contained on white instead of being cropped like on v1.
 */
export function ProductCard({ product, priority = false, className }: { product: CatalogProduct; priority?: boolean; className?: string }) {
  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line">
        {product.image ? (
          <Image
            src={product.image.src}
            alt={product.image.alt}
            width={product.image.width}
            height={product.image.height}
            priority={priority}
            sizes="(min-width: 1024px) 300px, 50vw"
            className="size-full object-contain p-[6%] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-step-n1 text-neutral-500">Photo coming soon</div>
        )}
      </div>
      <div className="relative mt-3.5 flex flex-1 flex-col gap-1 overflow-hidden pr-14">
        {product.number != null && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-2 right-0 font-number text-[4.5rem] leading-none font-black text-number transition-colors duration-200 group-hover:text-brand"
          >
            {product.number}
          </span>
        )}
        {product.club && <p className="text-step-n1 text-ink-muted">{product.club}</p>}
        <h3 className="font-heading text-[1.05rem] leading-snug font-semibold tracking-[-0.01em] text-ink">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>
        <Price paise={product.pricePaise} className="mt-auto pt-1 text-step-0" />
      </div>
    </article>
  );
}
