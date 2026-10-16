import type { OrderStatus, PublicOrder } from "@/lib/checkout/api";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/ui/icons";

const STEPS: { status: Exclude<OrderStatus, "cancelled">; label: string; note: string }[] = [
  { status: "awaiting_payment", label: "Order placed", note: "Waiting for your UPI payment" },
  { status: "payment_submitted", label: "Payment submitted", note: "We're checking your payment" },
  { status: "paid", label: "Payment confirmed", note: "Your order is confirmed" },
  { status: "packed", label: "Packed", note: "Boxed and ready to ship" },
  { status: "shipped", label: "Shipped", note: "On its way to you" },
  { status: "delivered", label: "Delivered", note: "Enjoy the shirt" },
];

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** awaiting payment → payment submitted → paid → packed → shipped → delivered, or cancelled. */
export function OrderTimeline({ order }: { order: Pick<PublicOrder, "status" | "events"> }) {
  const at = new Map(order.events.map((e) => [e.status, e.at]));
  const cancelled = order.status === "cancelled";
  const reached = cancelled
    ? Math.max(...STEPS.map((s, i) => (at.has(s.status) ? i : -1)))
    : STEPS.findIndex((s) => s.status === order.status);
  const steps = cancelled ? STEPS.slice(0, reached + 1) : STEPS;

  return (
    <ol className="grid">
      {steps.map((s, i) => {
        const done = i < reached || (i === reached && !cancelled && s.status === "delivered");
        const current = i === reached && !cancelled;
        const time = at.get(s.status);
        return (
          <li key={s.status} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < steps.length - 1 || cancelled ? (
              <span aria-hidden className={cn("absolute top-7 bottom-0 left-[13px] w-px", i < reached ? "bg-brand" : "bg-line-strong")} />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border",
                done || (i < reached) ? "border-brand bg-brand text-brand-ink" : current ? "border-brand bg-bg text-brand-text" : "border-line-strong bg-bg text-ink-muted",
              )}
            >
              {done || i < reached ? <CheckIcon width={14} height={14} /> : <span className={cn("size-2 rounded-full", current ? "bg-brand" : "bg-line-strong")} />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("font-semibold", !(done || current || i < reached) && "text-ink-muted")}>{s.label}</p>
              <p className="text-step-n1 text-ink-muted">
                {current ? s.note : null}
                {current && time ? " · " : null}
                {time ? when(time) : null}
              </p>
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex gap-4" aria-current="step">
          <span aria-hidden className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink">
            <span className="text-step-n1 leading-none">×</span>
          </span>
          <div className="pt-0.5">
            <p className="font-semibold">Cancelled</p>
            <p className="text-step-n1 text-ink-muted">{at.get("cancelled") ? when(at.get("cancelled")!) : "This order was cancelled"}</p>
          </div>
        </li>
      )}
    </ol>
  );
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_submitted: "Payment submitted",
  paid: "Payment confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
