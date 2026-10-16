"use client";

import { useStoreSettings, type PolicyKey } from "@/lib/settings";

/** Policy text from admin Settings (plain text; blank lines start a new paragraph). */
export function PolicyView({ policy, title }: { policy: PolicyKey; title: string }) {
  const { status, settings } = useStoreSettings();
  const text = settings.policies[policy];
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-step-4 font-bold">{title}</h1>
      {text ? (
        <div className="mt-8 grid gap-4 text-ink-muted">
          {text.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
      ) : status === "idle" || status === "loading" ? (
        <div className="mt-8 grid gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-ink-muted">This page is being written. If you have a question, message us using the contact details below.</p>
      )}
    </main>
  );
}
