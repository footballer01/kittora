"use client";

import { useToast } from "@/lib/stores/toast";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, CloseIcon } from "./icons";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:right-6 sm:bottom-6 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm items-center transition duration-200 starting:translate-y-2 starting:opacity-0 gap-3 rounded-2xl border border-line bg-surface py-3 pr-2 pl-4 text-step-n1 text-ink shadow-[0_12px_40px_-12px_rgb(0_0_0/0.6)]"
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              t.tone === "warning" ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
            )}
          >
            {t.tone === "warning" ? <AlertIcon width={14} height={14} /> : <CheckIcon width={14} height={14} />}
          </span>
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Dismiss"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
