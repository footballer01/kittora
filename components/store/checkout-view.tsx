"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { refreshLive } from "@/lib/catalog/live";
import { placeOrder } from "@/lib/checkout/api";
import { validateCheckout, type CheckoutErrors, type CheckoutInput } from "@/lib/checkout/form";
import { lookupPincode } from "@/lib/checkout/pincode";
import { deliveryEstimate, formatDays } from "@/lib/checkout/rules";
import { useCartLines } from "@/lib/checkout/use-cart-lines";
import { useStoreSettings } from "@/lib/settings";
import { useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydrated";
import { useRecentOrders } from "@/lib/stores/orders";
import { Button, ButtonLink } from "@/components/ui/button";
import { ShieldIcon, TruckIcon } from "@/components/ui/icons";
import { TextArea, TextField } from "@/components/ui/input";
import { OrderSummary } from "./order-summary";
import { Price } from "./price";
import { Turnstile, TURNSTILE_SITE_KEY } from "./turnstile";

const EMPTY: CheckoutInput = { name: "", phone: "", email: "", address: "", pincode: "", city: "", state: "" };
const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function CheckoutView() {
  const { zones } = useStoreSettings();
  const hydrated = useHydrated(useCart);
  const cart = useCartLines();
  const clear = useCart((s) => s.clear);
  const remember = useRecentOrders((s) => s.remember);

  const [form, setForm] = useState<CheckoutInput>(EMPTY);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [place, setPlace] = useState<{ pin: string; found: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState(0);
  const [busy, setBusy] = useState(false);
  const autofilled = useRef<{ city: string; state: string } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const set = (k: keyof CheckoutInput) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  // Pincode → city and state, unless the shopper has typed their own.
  const pin = form.pincode.trim();
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pin)) return;
    let live = true;
    void lookupPincode(pin).then((hit) => {
      if (!live) return;
      setPlace({ pin, found: !!hit });
      if (!hit) return;
      setForm((f) => {
        const untouched = (k: "city" | "state") => !f[k].trim() || f[k] === autofilled.current?.[k];
        const next = { ...f, city: untouched("city") ? hit.city : f.city, state: untouched("state") ? hit.state : f.state };
        autofilled.current = { city: next.city, state: next.state };
        return next;
      });
      setErrors((x) => ({ ...x, city: undefined, state: undefined }));
    });
    return () => {
      live = false;
    };
  }, [pin]);

  const zone = deliveryEstimate(pin, zones);
  const pinNote = place?.pin === pin ? (place.found ? "City and state filled from your pincode" : "We couldn't find this pincode. Please type your city and state.") : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validateCheckout(form);
    if (!v.ok) {
      setErrors(v.errors);
      const first = Object.keys(v.errors)[0];
      document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (cart.blocked) return setFormError("Some items in your cart need attention. Update them in your cart first.");
    if (TURNSTILE_SITE_KEY && !token) return setFormError("Please complete the security check below.");
    setBusy(true);
    const items = cart.rows.map((r) => ({ slug: r.line.slug, size: r.line.size, qty: r.line.qty }));
    const res = await placeOrder(v.values, items, token);
    if (res.ok) {
      remember({ number: res.data.number, phone: v.values.phone, totalPaise: res.data.total_paise, placedAt: res.data.created_at });
      clear();
      // A full load: the pay page is one static file served for every order number,
      // so the client router has no per-order payload to fetch.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/order/${res.data.number}/pay`);
      return;
    }
    setBusy(false);
    setToken(null);
    setChallenge((n) => n + 1);
    if (res.error.code === "out_of_stock" || res.error.code === "unavailable") void refreshLive();
    setFormError(res.error.message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  if (hydrated && cart.rows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-step-4 font-bold">Checkout</h1>
        <p className="mt-3 text-ink-muted">Your cart is empty.</p>
        <ButtonLink href="/shop" className="mt-6">
          Browse jerseys
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <p className="text-step-n1 font-medium text-ink-muted">Guest checkout · no account needed</p>
      <h1 className="mt-1 text-step-4 font-bold sm:text-step-5">Checkout</h1>
      <form noValidate onSubmit={submit} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="grid min-w-0 gap-8">
          <fieldset className="grid min-w-0 gap-4">
            <legend className="mb-4 font-heading text-step-1 font-bold">Contact</legend>
            <TextField label="Full name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Mobile number"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={form.phone}
                onChange={set("phone")}
                error={errors.phone}
                hint="For delivery updates and to track your order"
              />
              <TextField
                label="Email (optional)"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
                hint="We'll email your order confirmation"
              />
            </div>
          </fieldset>
          <fieldset className="grid min-w-0 gap-4">
            <legend className="mb-4 font-heading text-step-1 font-bold">Delivery address</legend>
            <TextArea
              label="Address"
              name="address"
              rows={3}
              autoComplete="street-address"
              placeholder="House / flat, street, area, landmark"
              value={form.address}
              onChange={set("address")}
              error={errors.address}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Pincode"
                name="pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => set("pincode")({ target: { value: e.target.value.replace(/\D/g, "") } })}
                error={errors.pincode}
              />
              <TextField label="City" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors.city} />
              <TextField label="State" name="state" autoComplete="address-level1" value={form.state} onChange={set("state")} error={errors.state} />
            </div>
            {(pinNote || zone) && (
              <div className="grid gap-1 text-step-n1 text-ink-muted" aria-live="polite">
                {pinNote && <p>{pinNote}</p>}
                {zone && (
                  <p className="inline-flex items-center gap-2 text-ink">
                    <TruckIcon width={18} height={18} className="text-ink-muted" /> Usually delivered in {formatDays(zone)}
                  </p>
                )}
              </div>
            )}
          </fieldset>
        </div>

        <aside className="rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:sticky lg:top-24">
          <h2 className="font-heading text-step-1 font-bold">Your order</h2>
          <ul className="my-4 grid gap-3">
            {cart.rows.map((r) => (
              <li key={r.key} className="flex min-w-0 items-center gap-3">
                <div className="relative w-16 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-line">
                  {r.line.image && <Image src={r.line.image} alt="" width={128} height={96} className="aspect-[4/3] w-full object-contain p-1" />}
                  <span className="absolute -top-0 -right-0 flex h-5 min-w-5 items-center justify-center rounded-bl-lg bg-ink px-1 font-mono text-[11px] font-bold text-bg">
                    {r.line.qty}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-step-n1 font-medium">{r.line.name}</p>
                  <p className="text-step-n2 text-ink-muted">Size {r.line.size}</p>
                  {r.issue && <p className="text-step-n2 text-brand-text">Needs attention in your cart</p>}
                </div>
                <Price paise={r.unitPricePaise * r.line.qty} className="shrink-0 text-step-n1" />
              </li>
            ))}
          </ul>
          <OrderSummary subtotalPaise={cart.subtotalPaise} shipping={cart.shipping} totalPaise={cart.totalPaise}>
            <div className="mt-2">
              <Turnstile onToken={setToken} resetKey={challenge} />
            </div>
            {formError && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-step-n1 text-ink">
                {formError}
              </p>
            )}
            {!supabaseReady && <p className="text-step-n1 text-ink-muted">Online ordering opens soon. You can still review your order here.</p>}
            <Button type="submit" size="lg" className="mt-1 w-full" loading={busy} disabled={!hydrated || cart.blocked}>
              Place order · pay by UPI
            </Button>
            <p className="flex items-start gap-2 text-step-n2 text-ink-muted">
              <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0" />
              Next you&apos;ll see a UPI QR for the exact total. Prices and stock are confirmed when you place the order.
            </p>
          </OrderSummary>
        </aside>
      </form>
    </main>
  );
}
