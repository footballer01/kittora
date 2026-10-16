"use client";

import { useSearchParams } from "next/navigation";
import { getOrderByNumber } from "@/lib/admin/api";
import { Button } from "@/components/ui/button";
import { ErrorNote, Loading, useLoad } from "./ui";

/** Printable packing slip: ship-to, items and sizes (no prices). */
export function PackingSlip() {
  const number = useSearchParams().get("n") ?? "";
  const order = useLoad(() => getOrderByNumber(number), [number]);
  if (order.error) return <ErrorNote message={order.error} />;
  if (order.loading) return <Loading />;
  const o = order.data;
  if (!o) return <ErrorNote message={`No order ${number}.`} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-step-n1 text-ink-muted">Print this and put it in the parcel.</p>
        <Button size="lg" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <article data-theme="light" className="rounded-2xl bg-white p-6 text-black print:rounded-none print:p-0 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/20 pb-4">
          <div>
            <p className="font-heading text-step-2 font-extrabold tracking-[-0.02em]">KITTORA</p>
            <p className="text-step-n1">Packing slip</p>
          </div>
          <div className="text-right text-step-n1">
            <p className="font-mono text-step-0 font-semibold">{o.number}</p>
            <p>{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </header>
        <section className="mt-6">
          <h2 className="text-step-n1 font-semibold uppercase tracking-wide">Ship to</h2>
          <p className="mt-2 text-step-1 leading-snug whitespace-pre-line">
            {o.name}
            {"\n"}
            {o.address}
            {"\n"}
            {o.city}, {o.state} {o.pincode}
            {"\n"}
            Phone: {o.phone}
          </p>
        </section>
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black/30 text-step-n1">
              <th className="py-2 pr-3">Qty</th>
              <th className="py-2 pr-3">Item</th>
              <th className="py-2">Size</th>
              <th className="py-2 pl-3 text-right print:table-cell">Packed</th>
            </tr>
          </thead>
          <tbody>
            {o.order_items.map((i) => (
              <tr key={i.id} className="border-b border-black/10">
                <td className="py-3 pr-3 text-step-1 font-semibold">{i.qty}</td>
                <td className="py-3 pr-3">{i.name}</td>
                <td className="py-3 font-semibold">{i.size}</td>
                <td className="py-3 pl-3 text-right">
                  <span className="inline-block size-5 border border-black" aria-label="Tick when packed" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-8 text-step-n1">Paid by UPI. Thank you for shopping with KITTORA.</p>
      </article>
    </>
  );
}
