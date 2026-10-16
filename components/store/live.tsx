"use client";

import { useLiveProduct } from "@/lib/catalog/live";
import type { CatalogProduct } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { useWishlist } from "@/lib/stores/wishlist";
import { HeartIcon } from "@/components/ui/icons";
import { Price } from "./price";

type Slim = Pick<CatalogProduct, "slug" | "pricePaise" | "variants">;

/** Build-time price, replaced by the live price once loaded. */
export function LivePrice({ product, tone, className }: { product: Slim; tone?: "ink" | "brand"; className?: string }) {
  const live = useLiveProduct(product);
  if (!live.available) return <span className={cn("text-step-n1 text-ink-muted", className)}>No longer available</span>;
  return <Price paise={live.pricePaise} tone={tone} className={className} />;
}

/** Card size chips with live stock; sold-out sizes are dimmed, never struck through. */
export function CardSizes({ product }: { product: Slim }) {
  const { variants } = useLiveProduct(product);
  if (!variants.length) return null;
  return (
    <ul aria-label="Sizes" className="card-sizes absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-1.5">
      {variants.map((v) => (
        <li
          key={v.size}
          className={cn(
            "rounded-full bg-white/90 px-2.5 py-1 font-mono text-[0.72rem] font-semibold text-neutral-900 shadow-sm backdrop-blur",
            v.stock === 0 && "text-neutral-400",
          )}
        >
          {v.size}
          {v.stock === 0 && <span className="sr-only"> sold out</span>}
        </li>
      ))}
    </ul>
  );
}

/** Heart toggle; the wishlist lives in this browser only (no accounts). */
export function WishlistButton({ slug, name, variant = "card", className }: { slug: string; name: string; variant?: "card" | "inline"; className?: string }) {
  const saved = useWishlist((s) => s.slugs.includes(slug));
  const toggle = useWishlist((s) => s.toggle);
  const label = saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`;
  if (variant === "inline") {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={label}
        onClick={() => toggle(slug)}
        className={cn(
          "inline-flex h-13 items-center justify-center gap-2 rounded-full border border-line-strong px-5 font-semibold text-ink transition-colors hover:border-ink",
          className,
        )}
      >
        <HeartIcon filled={saved} className={cn("transition-transform", saved && "scale-110 text-brand")} />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      onClick={() => toggle(slug)}
      className={cn(
        "absolute top-2 left-2 z-10 flex size-11 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-sm backdrop-blur transition-colors hover:bg-white",
        className,
      )}
    >
      <HeartIcon filled={saved} width={18} height={18} className={cn(saved && "text-[#e0533d]")} />
    </button>
  );
}
