import Image from "next/image";
import { defaultHref, isWide, type CatalogProduct, type ProductHref } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { CardSizes, LivePrice, WishlistButton } from "./live";

/**
 * Image-first card, one 4:5 frame on a calm white backdrop. Desktop hover (or
 * the touch "Quick look" toggle) crossfades to the back image and reveals sizes.
 * Product links are plain <a> so cross-document view transitions and
 * speculation rules apply.
 */
export function ProductCard({
  product,
  href = defaultHref,
  priority = false,
  className,
}: {
  product: CatalogProduct;
  href?: ProductHref;
  priority?: boolean;
  className?: string;
}) {
  const { image, backImage } = product;
  const sizes = product.variants;
  return (
    <article className={cn("card group relative", className)} data-vt-root>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-white" data-vt-img>
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            priority={priority}
            sizes="(min-width: 1024px) 300px, 46vw"
            className={cn("absolute inset-0 size-full", isWide(image) ? "object-contain p-[7%]" : "object-cover")}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-step-n1 text-neutral-500">Photo coming soon</div>
        )}
        {backImage && (
          <Image
            src={backImage.src}
            alt=""
            width={backImage.width}
            height={backImage.height}
            loading="lazy"
            sizes="(min-width: 1024px) 300px, 46vw"
            className={cn("card-back absolute inset-0 size-full", isWide(backImage) ? "object-contain p-[7%]" : "object-cover")}
          />
        )}
        <CardSizes product={product} />
        <WishlistButton slug={product.slug} name={product.name} className="card-wish" />
        {(backImage || sizes.length > 0) && (
          <label className="card-flip absolute top-2 right-2 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-sm backdrop-blur has-focus-visible:outline-2 has-focus-visible:outline-focus">
            <input type="checkbox" className="card-flip-input sr-only" aria-label={`Quick look: ${product.name}`} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
              <path d="M18 3v4h-4M6 21v-4h4" />
            </svg>
          </label>
        )}
      </div>
      <div className="mt-4 grid gap-1 pr-2">
        {product.club && <p className="text-step-n1 text-ink-muted">{product.club}</p>}
        <h3 className="font-heading text-[1.02rem] leading-snug font-semibold tracking-[-0.01em] text-ink">
          <a href={href(product)} data-vt className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[var(--radius-card)] focus-visible:after:outline-2 focus-visible:after:outline-focus">
            {product.name}
          </a>
        </h3>
        <LivePrice product={product} className="text-step-n1" />
      </div>
    </article>
  );
}
