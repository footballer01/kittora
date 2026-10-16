import type { OrderStatus } from "@/lib/checkout/api";

// Mirrors public.order_transition_ok() in drizzle/0010_admin_functions.sql
// (tests/db/admin.test.ts checks they agree). Postgres enforces it; this only
// decides which buttons to show.
export const FLOW: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["payment_submitted", "paid", "cancelled"],
  payment_submitted: ["paid", "cancelled"],
  paid: ["packed", "shipped", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_submitted: "Payment submitted",
  paid: "Paid",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Buttons for an order, most likely next step first. "Payment submitted" is the customer's step. */
export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  paid: "Mark paid",
  packed: "Mark packed",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

export function actionsFor(status: OrderStatus): OrderStatus[] {
  return FLOW[status].filter((s) => s in ACTION_LABEL);
}

/** Filter tabs, "Payment submitted" first (that's what admins check from their phones). */
export const ORDER_FILTERS: { key: OrderStatus | "all" | "open"; label: string }[] = [
  { key: "payment_submitted", label: "Payment submitted" },
  { key: "paid", label: "To pack" },
  { key: "packed", label: "To ship" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];
