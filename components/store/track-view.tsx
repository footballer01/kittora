"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { trackOrder, type PublicOrder } from "@/lib/checkout/api";
import { normalizeOrderNumber, normalizePhone } from "@/lib/checkout/rules";
import { formatPaise } from "@/lib/money";
import { useRecentOrders, type RecentOrder } from "@/lib/stores/orders";
import { Button, buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { OrderTimeline, STATUS_LABEL } from "./order-timeline";
import { OrderItems } from "./pay-view";

const placed = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function TrackView() {
  const recent = useRecentOrders((s) => s.orders);
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ number?: string; phone?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  async function lookup(n: string, p: string) {
    setBusy(true);
    setErrors({});
    const r = await trackOrder(n, p);
    setBusy(false);
    if (!r.ok) return setErrors({ form: r.error.message });
    if (!r.data) {
      setOrder(null);
      return setErrors({ form: "We couldn't find an order with that number and mobile number. Check both and try again." });
    }
    setOrder(r.data);
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  // ?n=<number> prefills; if this device placed that order, look it up straight away.
  const auto = useRef(false);
  useEffect(() => {
    const n = normalizeOrderNumber(new URLSearchParams(window.location.search).get("n") ?? "");
    if (!n || auto.current) return;
    const mine = recent.find((o) => o.number === n);
    setNumber(n);
    if (mine) {
      auto.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this device placed the order
      setPhone(mine.phone);
      void lookup(n, mine.phone);
    }
  }, [recent]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = normalizeOrderNumber(number);
    const p = normalizePhone(phone);
    const errs = {
      number: /^KT[A-Z0-9]{10}$/.test(n) ? undefined : "Enter the order number, like KT7H2Q9MXC4P",
      phone: p ? undefined : "Enter the 10-digit mobile number you ordered with",
    };
    if (errs.number || errs.phone) return setErrors(errs);
    void lookup(n, p!);
  }

  const pick = (o: RecentOrder) => {
    setNumber(o.number);
    setPhone(o.phone);
    void lookup(o.number, o.phone);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <h1 className="text-step-4 font-bold sm:text-step-5">Track your order</h1>
      <p className="mt-2 max-w-[52ch] text-ink-muted">Enter your order number and the mobile number you used at checkout.</p>

      <form noValidate onSubmit={submit} className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <TextField
          label="Order number"
          name="number"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="KT…"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          error={errors.number}
        />
        <TextField label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        <Button type="submit" size="lg" loading={busy} className="sm:mt-[1.85rem]">
          Track
        </Button>
      </form>
      {errors.form && (
        <p role="alert" className="mt-4 max-w-2xl text-brand-text">
          {errors.form}
        </p>
      )}

      {!order && recent.length > 0 && (
        <section className="mt-10 max-w-2xl" aria-labelledby="recent-h">
          <h2 id="recent-h" className="text-step-n1 font-medium text-ink-muted">
            Orders from this device
          </h2>
          <ul className="mt-3 grid gap-2">
            {recent.map((o) => (
              <li key={o.number}>
                <button
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface"
                >
                  <span className="font-mono font-semibold">{o.number}</span>
                  <span className="text-step-n1 text-ink-muted">{formatPaise(o.totalPaise)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order && (
        <section className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start" aria-labelledby="order-h">
          <div>
            <p className="text-step-n1 text-ink-muted">Placed {placed(order.created_at)}</p>
            <h2 id="order-h" ref={resultRef} tabIndex={-1} className="mt-1 font-heading text-step-3 font-bold outline-none">
              <span className="font-mono">{order.number}</span> · {STATUS_LABEL[order.status]}
            </h2>
            <div className="mt-6 rounded-[var(--radius-card)] border border-line p-5 sm:p-6">
              <OrderTimeline order={order} />
            </div>
            {order.status === "awaiting_payment" && (
              // A plain link: the pay page is one static file served for every order number.
              <a href={`/order/${order.number}/pay`} className={buttonClass({ className: "mt-6" })}>
                Pay {formatPaise(order.total_paise)} now
              </a>
            )}
          </div>
          <OrderItems order={order} />
        </section>
      )}
    </main>
  );
}
