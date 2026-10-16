"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { logout, refreshAdmin, useAdminSession } from "@/lib/admin/session";
import { Loading } from "./ui";
import { PublishButton } from "./publish";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/edits", label: "Edits" },
  { href: "/admin/zones", label: "Delivery" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/account", label: "Account" },
];

const strip = (p: string) => p.replace(/\/+$/, "") || "/";

/** Admin frame: checks the session, then shows the top bar and navigation. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = strip(usePathname());
  const router = useRouter();
  const status = useAdminSession((s) => s.status);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    void refreshAdmin();
  }, []);
  useEffect(() => {
    if (!isLogin && (status === "signed-out" || status === "needs-code")) router.replace("/admin/login");
  }, [isLogin, status, router]);

  if (isLogin) return <main id="main" className="mx-auto grid w-full max-w-md flex-1 content-center px-4 py-12">{children}</main>;
  if (status !== "ready" && status !== "off") return <main className="mx-auto w-full max-w-5xl px-4">{<Loading label="Checking your sign-in…" />}</main>;

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2" aria-label="Admin dashboard">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-heading font-extrabold text-bg">K</span>
            <span className="font-heading text-[1.1rem] font-extrabold tracking-[-0.02em]">KITTORA</span>
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-step-n2 text-ink-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <PublishButton compact />
            <button type="button" onClick={() => void logout()} className="h-10 rounded-full px-3 text-step-n1 whitespace-nowrap text-ink-muted hover:bg-surface hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto max-w-5xl overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-1 pb-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full px-4 text-step-n1 font-medium whitespace-nowrap transition-colors",
                    active(n.href) ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {status === "off" && (
        <p role="status" className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-5xl rounded-xl border border-warning/60 p-3 text-step-n1 text-warning">
          Supabase isn&apos;t connected yet, so nothing here can load. Follow LAUNCH.md step 1.
        </p>
      )}
      <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
