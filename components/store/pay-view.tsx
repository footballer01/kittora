"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { submitPayment, trackOrder, uploadProof, type PublicOrder } from "@/lib/checkout/api";
import { proofError, utrSchema } from "@/lib/checkout/form";
import { normalizeOrderNumber, normalizePhone } from "@/lib/checkout/rules";
import { upiLink, whatsappLink } from "@/lib/checkout/upi";
import { formatPaise } from "@/lib/money";
import { useStoreSettings } from "@/lib/settings";
import { useHydrated } from "@/lib/stores/hydrated";
import { useRecentOrders } from "@/lib/stores/orders";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { CheckIcon, WhatsAppIcon } from "@/components/ui/icons";
import { TextField } from "@/components/ui/input";
import { OrderTimeline, STATUS_LABEL } from "./order-timeline";
import { Price } from "./price";
import { QrCode } from "./qr-code";

/** The order number from /order/<number>/pay (one static page serves every order). */
function useOrderNumber() {
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => {
    const m = window.location.pathname.match(/^\/order\/([^/]+)\/pay\/?$/);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once after mount
    setNumber(m ? normalizeOrderNumber(decodeURIComponent(m[1])) : "");
  }, []);
  return number;
}

const deadline = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function PayView() {
  const number = useOrderNumber();
  const hydrated = useHydrated(useRecentOrders);
  const saved = useRecentOrders((s) => s.orders.find((o) => o.number === number));
  const [phone, setPhone] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const activePhone = phone ?? saved?.phone ?? null;

  useEffect(() => {
    if (!number || !activePhone) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for the fetch below
    setState("loading");
    void trackOrder(number, activePhone).then((r) => {
      if (!live) return;
      if (!r.ok) {
        setError(r.error.message);
        setState("error");
      } else if (!r.data) setState("missing");
      else {
        setOrder(r.data);
        setState("ready");
      }
    });
    return () => {
      live = false;
    };
  }, [number, activePhone]);

  if (number === null || !hydrated || state === "loading" || (activePhone && state === "idle")) {
    return <Shell number={number}><div className="h-72 animate-pulse rounded-[var(--radius-card)] bg-surface" aria-hidden /></Shell>;
  }
  if (!number) {
    return (
      <Shell number={null}>
        <p className="text-ink-muted">This payment link is incomplete.</p>
        <ButtonLink href="/track" className="mt-6">Find your order</ButtonLink>
      </Shell>
    );
  }
  if (!activePhone || state === "missing" || state === "error") {
    return (
      <Shell number={number}>
        <PhoneGate
          message={state === "missing" ? "That phone number doesn't match this order." : state === "error" ? error : null}
          onPhone={(p) => {
            setState("idle");
            setPhone(p);
          }}
        />
      </Shell>
    );
  }
  if (!order) return null;
  return (
    <Shell number={order.number}>
      {order.status === "awaiting_payment" && !(order.expires_at && new Date(order.expires_at) <= new Date()) ? (
        <PayPanel order={order} phone={activePhone} onPaid={setOrder} />
      ) : (
        <StatusPanel order={order} />
      )}
    </Shell>
  );
}

function Shell({ number, children }: { number: string | null; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-12">
      <p className="text-step-n1 font-medium text-ink-muted">
        Order <span className="font-mono font-semibold text-ink">{number || "—"}</span>
      </p>
      <div className="mt-1">{children}</div>
    </main>
  );
}

function PhoneGate({ message, onPhone }: { message: string | null; onPhone: (phone: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | undefined>();
  return (
    <form
      noValidate
      className="max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const p = normalizePhone(value);
        if (!p) return setErr("Enter the 10-digit mobile number you ordered with");
        onPhone(p);
      }}
    >
      <h1 className="text-step-3 font-bold">Open your order</h1>
      <p className="mt-2 text-ink-muted">For your privacy, enter the mobile number used for this order.</p>
      {message && <p role="alert" className="mt-4 text-brand-text">{message}</p>}
      <TextField className="mt-6" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} error={err} />
      <Button type="submit" size="lg" className="mt-4 w-full sm:w-auto">Continue</Button>
    </form>
  );
}

function PayPanel({ order, phone, onPaid }: { order: PublicOrder; phone: string; onPaid: (o: PublicOrder) => void }) {
  const { settings, status } = useStoreSettings();
  const total = formatPaise(order.total_paise);
  const link = settings.upiId ? upiLink({ upiId: settings.upiId, payee: settings.payeeName, totalPaise: order.total_paise, orderNumber: order.number }) : null;
  const wa = settings.whatsapp
    ? whatsappLink(settings.whatsapp, `Hi, I'd like the UPI ID to pay for order ${order.number} (${total})`)
    : null;
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div>
        <h1 className="text-step-4 font-bold">Pay {total} by UPI</h1>
        <p className="mt-2 max-w-[52ch] text-ink-muted">
          Your order is reserved. Pay the exact amount, then send us the UPI reference so we can confirm it.
          {order.expires_at && <> Please pay by <span className="text-ink">{deadline(order.expires_at)}</span>; unpaid orders are released after that.</>}
        </p>

        <section aria-labelledby="pay-h" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <h2 id="pay-h" className="sr-only">Pay</h2>
          {/* On a phone the QR can't be scanned from its own screen: the app link comes first. */}
          {link && (
            <a href={link} className={buttonClass({ size: "lg", className: "mb-6 w-full sm:hidden" })}>
              Pay with UPI app
            </a>
          )}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {link ? (
              <QrCode value={link} label={`UPI QR code to pay ${total} for order ${order.number}`} className="w-56 shrink-0 rounded-xl sm:w-52" />
            ) : settings.qrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image on Supabase Storage
              <img src={settings.qrImageUrl} alt={`UPI QR code for KITTORA`} className="w-56 shrink-0 rounded-xl bg-white p-2 sm:w-52" />
            ) : status === "loading" || status === "idle" ? (
              <div className="size-56 shrink-0 animate-pulse rounded-xl bg-surface-2 sm:size-52" aria-hidden />
            ) : null}
            <div className="grid gap-3 text-center sm:text-left">
              <p className="text-step-n1 text-ink-muted">Amount to pay</p>
              <p className="-mt-2 font-mono text-step-4 font-bold tabular-nums">{total}</p>
              <p className="max-w-[40ch] text-ink-muted">
                {link || settings.qrImageUrl ? <>Scan this QR in any UPI app to pay {total}.</> : <>Ask us for the UPI ID to pay {total}.</>}
                {settings.whatsapp && <> You can also request the UPI ID on WhatsApp at {settings.whatsapp}.</>}
              </p>
              <button
                type="button"
                className="justify-self-center text-step-n1 font-medium text-ink underline underline-offset-4 sm:justify-self-start"
                onClick={() => {
                  void navigator.clipboard?.writeText(order.number).then(() => setCopied(true));
                }}
              >
                {copied ? "Order number copied" : `Copy order number ${order.number}`}
              </button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:flex">
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary", size: "lg", className: "h-auto min-h-13 w-full px-5 py-3 text-center !whitespace-normal sm:w-auto" })}>
                <WhatsAppIcon width={20} height={20} /> Ask for the UPI ID on WhatsApp
              </a>
            )}
          </div>
        </section>

        <UtrForm order={order} phone={phone} onPaid={onPaid} />
      </div>
      <OrderItems order={order} />
    </div>
  );
}

function UtrForm({ order, phone, onPaid }: { order: PublicOrder; phone: string; onPaid: (o: PublicOrder) => void }) {
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ utr?: string; file?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const u = utrSchema.safeParse(utr);
    const fileErr = file ? proofError(file) : null;
    if (!u.success || fileErr) return setErrors({ utr: u.success ? undefined : u.error.issues[0].message, file: fileErr ?? undefined });
    setErrors({});
    setBusy(true);
    let proof: string | null = null;
    if (file && order.upload_key) {
      const up = await uploadProof(order.upload_key, file);
      if (!up.ok) {
        setBusy(false);
        return setErrors({ file: up.error.message });
      }
      proof = up.data;
    }
    const r = await submitPayment(order.number, phone, u.data, proof);
    setBusy(false);
    if (!r.ok) return setErrors({ form: r.error.message });
    onPaid(r.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form noValidate onSubmit={submit} className="mt-10 grid max-w-xl gap-4">
      <div>
        <h2 className="font-heading text-step-2 font-bold">Paid? Tell us the UTR</h2>
        <p className="mt-1 text-ink-muted">Find the 12-digit UPI reference (UTR / UPI Ref No.) in your payment app&apos;s transaction details.</p>
      </div>
      <TextField
        label="UPI reference (UTR)"
        name="utr"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. 412345678901"
        value={utr}
        onChange={(e) => setUtr(e.target.value)}
        error={errors.utr}
      />
      <div className="grid gap-1.5">
        <label htmlFor="proof" className="text-step-n1 font-medium">
          Payment screenshot (optional)
        </label>
        <input
          id="proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-describedby="proof-hint"
          className="block w-full text-step-n1 text-ink-muted file:mr-4 file:h-11 file:rounded-full file:border file:border-line-strong file:bg-transparent file:px-5 file:font-semibold file:text-ink hover:file:border-ink"
        />
        <p id="proof-hint" className={errors.file ? "text-step-n1 text-brand-text" : "text-step-n1 text-ink-muted"}>
          {errors.file ?? "An image up to 5 MB. Only our team can see it."}
        </p>
      </div>
      {errors.form && <p role="alert" className="text-brand-text">{errors.form}</p>}
      <Button type="submit" size="lg" loading={busy} className="sm:justify-self-start">
        Submit payment details
      </Button>
    </form>
  );
}

function StatusPanel({ order }: { order: PublicOrder }) {
  const submitted = order.status === "payment_submitted";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div>
        {submitted ? (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-ink">
              <CheckIcon width={24} height={24} />
            </span>
            <h1 className="mt-5 text-step-4 font-bold">Thanks — payment details received</h1>
            <p className="mt-2 max-w-[52ch] text-ink-muted">We&apos;ll check your payment and confirm the order. You can follow every step on the tracking page.</p>
          </>
        ) : (
          <>
            <h1 className="text-step-4 font-bold">{STATUS_LABEL[order.status]}</h1>
            <p className="mt-2 text-ink-muted">
              {order.status === "cancelled" || order.status === "awaiting_payment"
                ? "This order is no longer waiting for payment."
                : "This order is already paid."}
            </p>
          </>
        )}
        <div className="mt-8 rounded-[var(--radius-card)] border border-line p-5 sm:p-6">
          <OrderTimeline order={order} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/track?n=${order.number}`} variant="secondary">
            Track this order
          </ButtonLink>
          <ButtonLink href="/shop" variant="ghost">
            Keep browsing
          </ButtonLink>
        </div>
      </div>
      <OrderItems order={order} />
    </div>
  );
}

export function OrderItems({ order }: { order: PublicOrder }) {
  return (
    <aside className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h2 className="font-heading text-step-1 font-bold">Order summary</h2>
      <ul className="my-4 grid gap-3">
        {order.items.map((i) => (
          <li key={`${i.slug}:${i.size}`} className="flex justify-between gap-3 text-step-n1">
            <span className="min-w-0">
              <Link href={`/product/${i.slug}`} className="hover:underline">
                {i.name}
              </Link>
              <span className="block text-ink-muted">
                Size {i.size} · Qty {i.qty}
              </span>
            </span>
            <Price paise={i.unit_price_paise * i.qty} />
          </li>
        ))}
      </ul>
      <div className="grid gap-2 border-t border-line pt-3 text-step-n1">
        <div className="flex justify-between">
          <span className="text-ink-muted">Subtotal</span>
          <Price paise={order.subtotal_paise} />
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Shipping</span>
          {order.shipping_paise ? <Price paise={order.shipping_paise} /> : <span className="font-semibold">Free</span>}
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold">Total</span>
          <Price paise={order.total_paise} className="text-step-1" />
        </div>
      </div>
      <p className="mt-4 text-step-n2 text-ink-muted">
        Delivering to {order.name}, {order.city}, {order.state} {order.pincode}
      </p>
    </aside>
  );
}
