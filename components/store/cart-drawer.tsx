"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useCartLines } from "@/lib/checkout/use-cart-lines";
import { loadSettings } from "@/lib/settings";
import { useCart } from "@/lib/stores/cart";
import { useRecentOrders } from "@/lib/stores/orders";
import { useWishlist } from "@/lib/stores/wishlist";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { BagIcon, CloseIcon } from "@/components/ui/icons";
import { CartLineItem } from "./cart-line";
import { Price } from "./price";

/** Loads the saved cart, wishlist and recent orders after mount (pages are static, so they render empty first). */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    void useWishlist.persist.rehydrate();
    void useRecentOrders.persist.rehydrate();
  }, []);
  return null;
}

export function CartDrawer() {
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const cart = useCartLines();
  const { count } = cart;
  useEffect(() => {
    if (open) void loadSettings();
  }, [open]);
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

          {cart.rows.length === 0 ? (
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
                {cart.rows.map((row) => (
                  <CartLineItem key={row.key} row={row} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
              <div className="border-t border-line bg-surface px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-muted">Subtotal</span>
                  <Price paise={cart.subtotalPaise} className="text-step-1" />
                </div>
                <p className="mt-1 text-step-n2 text-ink-muted">
                  {cart.blocked ? "Update the flagged items to check out." : "Shipping and the final total are confirmed at checkout."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ButtonLink href="/cart" variant="secondary" onClick={() => setOpen(false)}>
                    View cart
                  </ButtonLink>
                  <ButtonLink href="/checkout" onClick={() => setOpen(false)} aria-disabled={cart.blocked || undefined} tabIndex={cart.blocked ? -1 : undefined}>
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
