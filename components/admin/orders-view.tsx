"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/money";
import type { OrderStatus } from "@/lib/checkout/api";
import { listOrders, proofUrl, setOrderStatus, type AdminOrder } from "@/lib/admin/api";
import { ACTION_LABEL, actionsFor, ORDER_FILTERS } from "@/lib/admin/order-flow";
import { toast } from "@/lib/stores/toast";
import { Button, buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { ErrorNote, Loading, PageHeader, StatusBadge, timeAgo, useLoad } from "./ui";

type Filter = OrderStatus | "all";

export function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const filter = (ORDER_FILTERS.some((f) => f.key === params.get("status")) ? params.get("status") : "payment_submitted") as Filter;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const orders = useLoad(() => listOrders(query ? "all" : filter, query), [filter, query]);

  return (
    <>
      <PageHeader title="Orders" intro="Check the UTR against your UPI app (or bank SMS) before marking an order paid." />
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <TextField label="Find an order" placeholder="Order number, phone or name" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" variant="secondary" size="lg" className="self-end">
          Find
        </Button>
      </form>
      {!query && (
        <nav aria-label="Order status" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-2">
            {ORDER_FILTERS.map((f) => (
              <li key={f.key}>
                <button
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => router.replace(`/admin/orders?status=${f.key}`, { scroll: false })}
                  className={cn(
                    "h-10 rounded-full border px-4 text-step-n1 font-medium whitespace-nowrap",
                    filter === f.key ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {query && (
        <p className="text-step-n1 text-ink-muted">
          Results for &ldquo;{query}&rdquo;.{" "}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              setSearch("");
              setQuery("");
            }}
          >
            Clear
          </button>
        </p>
      )}
      {orders.error ? (
        <ErrorNote message={orders.error} onRetry={orders.reload} />
      ) : !orders.data ? (
        <Loading />
      ) : orders.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-muted">No orders here.</p>
      ) : (
        <ul className="grid gap-4">
          {orders.data.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} onChanged={orders.reload} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OrderCard({ order: o, onChanged }: { order: AdminOrder; onChanged: () => void }) {
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [shipping, setShipping] = useState(false);
  const [note, setNote] = useState(o.tracking_note ?? "");
  const [proof, setProof] = useState<string | null>(null);

  async function change(status: OrderStatus, trackingNote?: string) {
    if (status === "cancelled" && !window.confirm(`Cancel order ${o.number}? Its stock goes back on sale and the customer is emailed.`)) return;
    setBusy(status);
    try {
      await setOrderStatus(o.id, status, trackingNote);
      toast(`${o.number}: ${ACTION_LABEL[status]?.replace(/^Mark /, "marked ").replace("Cancel order", "cancelled")}`, "success");
      setShipping(false);
      onChanged();
    } catch (e) {
      toast((e as Error).message, "warning");
    } finally {
      setBusy(null);
    }
  }

  async function showProof() {
    if (!o.payment_proof_path) return;
    const url = await proofUrl(o.payment_proof_path);
    if (url) setProof(url);
    else toast("Couldn't open the screenshot.", "warning");
  }

  const items = o.order_items.reduce((n, i) => n + i.qty, 0);
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4" aria-label={`Order ${o.number}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-step-0 font-semibold">{o.number}</h2>
        <StatusBadge status={o.status} />
      </header>
      <p className="mt-1 text-step-n1 text-ink-muted">
        {timeAgo(o.created_at)} · {items} item{items === 1 ? "" : "s"} · <span className="font-semibold text-ink">{formatPaise(o.total_paise)}</span>
      </p>

      {o.utr && (
        <div className="mt-3 rounded-xl border border-warning/50 bg-warning/5 p-3">
          <p className="text-step-n2 text-ink-muted">UPI reference (UTR)</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-step-1 font-semibold break-all select-all">{o.utr}</p>
            <button
              type="button"
              className="h-10 rounded-full border border-line-strong px-3 text-step-n1"
              onClick={() => void navigator.clipboard?.writeText(o.utr!).then(() => toast("UTR copied"))}
            >
              Copy
            </button>
          </div>
          {o.payment_proof_path &&
            (proof ? (
              <a href={proof} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                <img src={proof} alt={`Payment screenshot for ${o.number}`} className="max-h-96 w-auto rounded-lg border border-line" />
              </a>
            ) : (
              <button type="button" onClick={() => void showProof()} className="mt-2 text-step-n1 font-semibold underline underline-offset-4">
                Show payment screenshot
              </button>
            ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 text-step-n1 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="font-medium">{o.name}</p>
          <p>
            <a href={`tel:+91${o.phone}`} className="underline underline-offset-4">
              {o.phone}
            </a>
            {o.email && <span className="block break-all text-ink-muted">{o.email}</span>}
          </p>
          <p className="mt-1 text-ink-muted">
            {o.address}, {o.city}, {o.state} {o.pincode}
          </p>
        </div>
        <ul className="grid content-start gap-1">
          {o.order_items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                {i.qty} × {i.name} <span className="text-ink-muted">({i.size})</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatPaise(i.unit_price_paise * i.qty)}</span>
            </li>
          ))}
          {o.shipping_paise > 0 && (
            <li className="flex justify-between gap-3 text-ink-muted">
              <span>Shipping</span>
              <span className="tabular-nums">{formatPaise(o.shipping_paise)}</span>
            </li>
          )}
        </ul>
      </div>
      {o.tracking_note && <p className="mt-3 text-step-n1">Tracking: {o.tracking_note}</p>}

      {shipping ? (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void change("shipped", note);
          }}
        >
          <TextField label="Courier and tracking number (shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Delhivery 1234567890" />
          <div className="grid gap-2 sm:flex">
            <Button type="submit" size="lg" loading={busy === "shipped"}>
              Mark shipped
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShipping(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          {actionsFor(o.status).map((s) => (
            <Button
              key={s}
              size="lg"
              variant={s === "cancelled" ? "ghost" : s === actionsFor(o.status)[0] ? "primary" : "secondary"}
              loading={busy === s}
              disabled={!!busy}
              onClick={() => (s === "shipped" ? setShipping(true) : void change(s))}
              className={s === "cancelled" ? "text-brand-text" : ""}
            >
              {ACTION_LABEL[s]}
            </Button>
          ))}
          {o.status !== "cancelled" && o.status !== "awaiting_payment" && (
            <a href={`/admin/orders/slip?n=${o.number}`} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary", size: "lg" })}>
              Packing slip
            </a>
          )}
        </div>
      )}
    </article>
  );
}
