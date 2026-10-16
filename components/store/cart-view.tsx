"use client";

import { useCartLines } from "@/lib/checkout/use-cart-lines";
import { useStoreSettings } from "@/lib/settings";
import { useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydrated";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon, BagIcon } from "@/components/ui/icons";
import { CartLineItem } from "./cart-line";
import { OrderSummary } from "./order-summary";

export function CartView() {
  useStoreSettings();
  const hydrated = useHydrated(useCart);
  const cart = useCartLines();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <h1 className="text-step-4 font-bold sm:text-step-5">
        Cart {cart.count > 0 && <span className="font-mono text-step-1 font-medium text-ink-muted">({cart.count})</span>}
      </h1>
      {!hydrated ? (
        <div className="mt-10 h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" aria-hidden />
      ) : cart.rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-ink-muted">
            <BagIcon width={26} height={26} />
          </span>
          <p className="font-heading text-step-2 font-bold">Your cart is empty</p>
          <p className="max-w-[40ch] text-ink-muted">Start building your archive. Your cart is saved on this device.</p>
          <ButtonLink href="/shop" className="mt-2">
            Browse jerseys
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <ul className="divide-y divide-line border-y border-line">
            {cart.rows.map((row) => (
              <CartLineItem key={row.key} row={row} size="lg" />
            ))}
          </ul>
          <aside className="rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:sticky lg:top-24">
            <h2 className="mb-4 font-heading text-step-1 font-bold">Summary</h2>
            <OrderSummary subtotalPaise={cart.subtotalPaise} shipping={cart.shipping} totalPaise={cart.totalPaise}>
              {cart.blocked && <p className="text-step-n1 text-brand-text">Update the flagged items to check out.</p>}
              <ButtonLink
                href="/checkout"
                size="lg"
                className="mt-3 w-full"
                iconEnd={<ArrowRightIcon width={18} height={18} />}
                aria-disabled={cart.blocked || undefined}
                tabIndex={cart.blocked ? -1 : undefined}
              >
                Checkout
              </ButtonLink>
              <p className="text-center text-step-n2 text-ink-muted">Guest checkout · Pay by UPI</p>
            </OrderSummary>
          </aside>
        </div>
      )}
    </main>
  );
}
