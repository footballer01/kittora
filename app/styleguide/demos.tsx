"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/types";
import { useCart } from "@/lib/stores/cart";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { BagIcon } from "@/components/ui/icons";
import { SizeSelector } from "@/components/ui/size-selector";
import { Price } from "@/components/store/price";

/** Preview stock levels to show every selector state (not product data). */
export const PREVIEW_VARIANTS: CatalogVariant[] = [
  { size: "S", stock: 8 },
  { size: "M", stock: 2 },
  { size: "L", stock: 12 },
  { size: "XL", stock: 0 },
  { size: "XXL", stock: null },
];

export function SizeSelectorDemo() {
  const [size, setSize] = useState<string | null>("M");
  return <SizeSelector variants={PREVIEW_VARIANTS} value={size} onChange={setSize} />;
}

export function AddToCartDemo({ product }: { product: CatalogProduct }) {
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  return (
    <div className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div>
        <p className="text-step-n1 text-ink-muted">{product.club}</p>
        <p className="font-heading text-step-1 font-semibold">{product.name}</p>
        <Price paise={product.pricePaise} className="text-step-1" />
      </div>
      <SizeSelector
        variants={product.variants}
        value={size}
        error={error}
        onChange={(s) => {
          setSize(s);
          setError(undefined);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          icon={<BagIcon width={18} height={18} />}
          onClick={() => {
            if (!size) return setError("Choose a size to add this jersey to your cart.");
            add({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              size,
              qty: 1,
              unitPricePaise: product.pricePaise,
              image: product.image?.src ?? null,
            });
            toast("Added to cart");
          }}
        >
          Add to cart
        </Button>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open cart drawer
        </Button>
      </div>
    </div>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => toast("Added to cart")}>
        Success toast
      </Button>
      <Button variant="secondary" onClick={() => toast("Only 2 left in M", "warning")}>
        Warning toast
      </Button>
    </div>
  );
}
