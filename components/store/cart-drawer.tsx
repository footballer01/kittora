"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { cartOps, lineKey, MAX_QTY_PER_LINE, useCart } from "@/lib/stores/cart";
import { useWishlist } from "@/lib/stores/wishlist";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { Price } from "./price";

/** Loads the saved cart and wishlist after mount (pages are static, so they render empty first). */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    void useWishlist.persist.rehydrate();
  }, []);
  return null;
}

export function CartDrawer() {
  const { lines, open, setOpen, setQty, remove } = useCart();
  const count = cartOps.count(lines);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-fade-out transition-opacity duration-200 starting:opacity-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface-2 shadow-2xl data-[state=closed]:animate-drawer-out transition-transform duration-300 ease-out starting:translate-x-full">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-heading text-step-1 font-bold">
              Cart {count > 0 && <span className="font-mono text-step-n1 font-medium text-ink-muted">({count})</span>}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close cart">
                <CloseIcon />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Jerseys in your cart</Dialog.Description>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface text-ink-muted">
                <BagIcon width={26} height={26} />
              </span>
              <div>
                <p className="font-heading text-step-1 font-semibold">Your cart is empty</p>
                <p className="mt-1 text-ink-muted">Start building your archive.</p>
              </div>
              <ButtonLink href="/shop" variant="secondary" onClick={() => setOpen(false)}>
                Browse jerseys
              </ButtonLink>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
                {lines.map((l) => {
                  const key = lineKey(l);
                  return (
                    <li key={key} className="flex gap-4 py-4">
                      <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
                        {l.image && <Image src={l.image} alt="" width={192} height={144} className="aspect-[4/3] w-full object-contain p-1.5" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 leading-snug font-medium hover:underline">
                          {l.name}
                        </Link>
                        <p className="mt-0.5 text-step-n1 text-ink-muted">Size {l.size}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-line-strong">
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-full hover:bg-surface"
                              aria-label={`Decrease quantity of ${l.name}, size ${l.size}`}
                              onClick={() => setQty(key, l.qty - 1)}
                            >
                              <MinusIcon width={16} height={16} />
                            </button>
                            <span className="w-7 text-center font-mono text-step-n1 font-semibold tabular-nums" aria-live="polite">
                              {l.qty}
                            </span>
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-full hover:bg-surface disabled:opacity-40"
                              aria-label={`Increase quantity of ${l.name}, size ${l.size}`}
                              disabled={l.qty >= MAX_QTY_PER_LINE}
                              onClick={() => setQty(key, l.qty + 1)}
                            >
                              <PlusIcon width={16} height={16} />
                            </button>
                          </div>
                          <Price paise={l.unitPricePaise * l.qty} />
                        </div>
                        <button type="button" onClick={() => remove(key)} className="mt-2 self-start text-step-n2 text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line bg-surface px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-muted">Subtotal</span>
                  <Price paise={cartOps.subtotalPaise(lines)} className="text-step-1" />
                </div>
                <p className="mt-1 text-step-n2 text-ink-muted">Shipping and the final total are confirmed at checkout.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ButtonLink href="/cart" variant="secondary" onClick={() => setOpen(false)}>
                    View cart
                  </ButtonLink>
                  <ButtonLink href="/checkout" onClick={() => setOpen(false)}>
                    Checkout
                  </ButtonLink>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
