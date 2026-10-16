"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { visibleCategories, type CategoryCounts } from "@/lib/catalog/categories";
import { useLiveCategoryCounts } from "@/lib/catalog/live-counts";
import { cartOps, useCart } from "@/lib/stores/cart";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/button";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { useWishlist } from "@/lib/stores/wishlist";
import { Logo } from "./logo";

const iconLink = "relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface active:bg-surface-2";

export function Header({ counts }: { counts: CategoryCounts }) {
  const live = useLiveCategoryCounts(counts);
  const nav = [{ label: "Shop all", href: "/shop" }, ...visibleCategories(live), { label: "Size guide", href: "/size-guide" }];
  const mobileNav = [...nav, { label: "Wishlist", href: "/wishlist" }];
  const pathname = usePathname();
  const count = useCart((s) => cartOps.count(s.lines));
  const setOpen = useCart((s) => s.setOpen);
  const saved = useWishlist((s) => s.slugs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="vt-header sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Logo />
        <nav aria-label="Main" className="ml-8 hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition-colors",
                  active ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/search" aria-label="Search jerseys" className={iconLink}>
            <SearchIcon />
          </Link>
          <Link href="/wishlist" aria-label={saved ? `Wishlist, ${saved} saved` : "Wishlist"} className={cn(iconLink, "max-sm:hidden")}>
            <HeartIcon />
            {saved > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-brand" aria-hidden />}
          </Link>
          <IconButton label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"} onClick={() => setOpen(true)}>
            <BagIcon />
            {count > 0 && (
              <span className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[11px] font-bold text-brand-ink">
                {count}
              </span>
            )}
          </IconButton>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <IconButton label="Open menu" className="md:hidden">
                <MenuIcon />
              </IconButton>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-fade-out transition-opacity duration-200 starting:opacity-0" />
              <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(86vw,360px)] flex-col border-l border-line bg-surface-2 p-4 data-[state=closed]:animate-drawer-out transition-transform duration-300 ease-out starting:translate-x-full">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="font-heading text-step-1 font-bold">Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton label="Close menu">
                      <CloseIcon />
                    </IconButton>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
                <nav aria-label="Mobile" className="mt-6 grid">
                  {mobileNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="border-b border-line py-4 font-heading text-step-2 font-bold tracking-tight"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
