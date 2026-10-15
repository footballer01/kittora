"use client";

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { useCart } from "@/lib/stores/cart";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { SizeSelector } from "@/components/ui/size-selector";
import { Price } from "./price";

/** Size, Add to cart and Buy now — plus a sticky Add to cart bar on mobile. */
export function BuyBox({ product }: { product: CatalogProduct }) {
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const soldOut = product.variants.length > 0 && product.variants.every((v) => v.stock === 0);

  const addToCart = (thenOpen = false) => {
    if (!size) {
      setError("Choose a size to add this jersey to your cart.");
      document.getElementById("sizes")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    add({ productId: product.id, slug: product.slug, name: product.name, size, qty: 1, unitPricePaise: product.pricePaise, image: product.image?.src ?? null });
    if (thenOpen) setOpen(true);
    else toast("Added to cart");
  };

  return (
    <>
      <SizeSelector
        id="sizes"
        variants={product.variants}
        value={size}
        error={error}
        onChange={(s) => {
          setSize(s);
          setError(undefined);
        }}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => addToCart()} disabled={soldOut}>
          {soldOut ? "Sold out" : "Add to cart"}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => addToCart(true)} disabled={soldOut}>
          Buy now
        </Button>
      </div>
      {/* Mobile: Add to cart stays in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-step-n1 text-ink-muted">{size ? `Size ${size}` : "Choose a size"}</p>
            <Price paise={product.pricePaise} className="text-step-0" />
          </div>
          <Button size="lg" onClick={() => addToCart()} disabled={soldOut} className="min-w-40">
            {soldOut ? "Sold out" : "Add to cart"}
          </Button>
        </div>
      </div>
    </>
  );
}
