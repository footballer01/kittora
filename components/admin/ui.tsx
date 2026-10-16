"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/checkout/api";
import { STATUS_LABEL } from "@/lib/admin/order-flow";

// Small building blocks for the admin panel: plain labels, big touch targets.

export function PageHeader({ title, intro, action }: { title: string; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-step-3 font-bold">{title}</h1>
        {intro && <p className="mt-1 max-w-[60ch] text-step-n1 text-ink-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className, id }: { title?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>
      {title && <h2 className="mb-4 font-heading text-step-0 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: "border-line-strong text-ink-muted",
  payment_submitted: "border-warning text-warning",
  paid: "border-success text-success",
  packed: "border-success text-success",
  shipped: "border-accent text-accent",
  delivered: "border-line-strong text-ink",
  cancelled: "border-line text-ink-muted line-through",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-step-n2 font-semibold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" | "success" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-step-n2",
        tone === "warning" ? "border-warning/60 text-warning" : tone === "success" ? "border-success/60 text-success" : "border-line-strong text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

/** On/off switch with a visible label and an explanation underneath. */
export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 py-1", disabled && "cursor-not-allowed opacity-50")}>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-step-n1 text-ink-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full border border-line-strong bg-surface-2 transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-0.5 after:left-0.5 after:size-5.5 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-brand-ink"
      />
    </label>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-brand-text/50 bg-brand-text/10 p-4 text-step-n1">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

/** Load data once on mount (and on demand), with loading and error states. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ data, loading: false }),
      (e: Error) => live && setState({ error: e.message || "Something went wrong.", loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass their own deps
  }, [tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1), set: (data: T) => setState({ data, loading: false }) };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
