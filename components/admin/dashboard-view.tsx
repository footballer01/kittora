"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/money";
import { getDashboard, getRecentActivity, listProducts, type AuditEntry } from "@/lib/admin/api";
import { needsDetails } from "@/lib/admin/needs-details";
import { STATUS_LABEL } from "@/lib/admin/order-flow";
import type { OrderStatus } from "@/lib/checkout/api";
import { Card, ErrorNote, Loading, PageHeader, timeAgo, useLoad } from "./ui";
import { PublishCard } from "./publish";

const mb = (b: number) => (b < 1048576 ? `${Math.max(0.1, b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1048576)} MB`);

function Stat({ label, value, href, alert }: { label: string; value: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="text-step-n1 text-ink-muted">{label}</span>
      <span className={cn("mt-1 block font-heading text-step-3 font-bold tabular-nums", alert && "text-warning")}>{value}</span>
    </>
  );
  const cls = cn("block min-w-0 rounded-2xl border bg-surface p-4", alert ? "border-warning/70" : "border-line", href && "transition-colors hover:border-ink-muted");
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const ENTITY: Record<string, string> = {
  products: "product",
  product_images: "photo",
  variants: "size or stock",
  edits: "edit",
  edit_items: "edit products",
  orders: "order",
  settings: "settings",
  delivery_zones: "delivery zone",
};
const SPECIAL: Record<string, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in attempt",
  login_blocked: "Sign-in blocked (too many attempts)",
  publish: "Published changes",
};

function describe(a: AuditEntry): string {
  if (SPECIAL[a.action]) return SPECIAL[a.action];
  const status = a.entity === "orders" ? (a.details?.status as OrderStatus | undefined) : undefined;
  if (status) return `Order marked ${STATUS_LABEL[status].toLowerCase()}`;
  const verb = { insert: "Added", update: "Changed", delete: "Deleted" }[a.action] ?? a.action;
  const name = (a.details?.name ?? a.details?.title) as string | undefined;
  return `${verb} ${ENTITY[a.entity ?? ""] ?? a.entity}${name ? ` · ${name}` : ""}`;
}

export function DashboardView() {
  const d = useLoad(getDashboard);
  const products = useLoad(listProducts);
  const activity = useLoad(() => getRecentActivity(8));

  if (d.error) return <ErrorNote message={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading />;
  const x = d.data;
  const needs = products.data?.filter(needsDetails).length;
  const storagePct = Math.min(100, (x.storage_bytes / x.storage_limit_bytes) * 100);
  const email = x.email;

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Payments to verify" value={String(x.payments_to_verify)} href="/admin/orders?status=payment_submitted" alert={x.payments_to_verify > 0} />
        <Stat label="Orders today" value={String(x.orders_today)} href="/admin/orders?status=all" />
        <Stat label="Revenue this week" value={formatPaise(x.revenue_week_paise)} />
        <Stat label="To pack or ship" value={String(x.to_pack)} href="/admin/orders?status=paid" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Publish changes" id="publish">
          <PublishCard />
        </Card>

        <Card title="Products">
          {needs === undefined ? (
            <p className="text-step-n1 text-ink-muted">Checking…</p>
          ) : (
            <Link href="/admin/products?filter=needs" className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:border-ink-muted">
              <span>Need details</span>
              <span className={cn("font-heading text-step-1 font-bold tabular-nums", needs > 0 && "text-warning")}>{needs}</span>
            </Link>
          )}
          <h3 className="mt-4 mb-2 text-step-n1 font-semibold">Low stock (2 or fewer)</h3>
          {x.low_stock.length === 0 ? (
            <p className="text-step-n1 text-ink-muted">Nothing low. Only products with &ldquo;Track stock&rdquo; on are counted.</p>
          ) : (
            <ul className="grid gap-1.5 text-step-n1">
              {x.low_stock.map((l) => (
                <li key={`${l.id}-${l.size}`}>
                  <Link href={`/admin/products/edit?id=${l.id}`} className="flex justify-between gap-3 hover:underline">
                    <span className="min-w-0 truncate">
                      {l.name} · {l.size}
                    </span>
                    <span className={cn("shrink-0 tabular-nums", l.stock === 0 && "text-warning")}>{l.stock === 0 ? "Sold out" : `${l.stock} left`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Storage">
          <p className="text-step-n1">
            {mb(x.storage_bytes)} of 1 GB used <span className="text-ink-muted">({storagePct.toFixed(1)}%)</span>
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Storage used" aria-valuenow={Math.round(storagePct)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", storagePct > 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.max(storagePct, 1)}%` }} />
          </div>
          <p className="mt-2 text-step-n2 text-ink-muted">Photos, videos and payment screenshots. The free plan allows 1 GB.</p>
        </Card>

        <Card title="Order emails">
          <dl className="grid grid-cols-2 gap-2 text-step-n1">
            {(
              [
                ["Waiting to send", email.pending ?? 0],
                ["Sent", email.sent ?? 0],
                ["Skipped (email not set up)", email.skipped ?? 0],
                ["Failed", email.failed ?? 0],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <dt className="text-ink-muted">{k}</dt>
                <dd className={cn("mt-1 font-heading text-step-1 font-bold tabular-nums", k === "Failed" && v > 0 && "text-warning")}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Recent activity">
        {activity.data?.length ? (
          <ul className="grid gap-2 text-step-n1">
            {activity.data.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{describe(a)}</span>
                <span className="shrink-0 text-ink-muted">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-step-n1 text-ink-muted">{activity.loading ? "Loading…" : "Nothing yet. Every change made here is recorded."}</p>
        )}
      </Card>
    </>
  );
}
