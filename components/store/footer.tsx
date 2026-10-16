import Link from "next/link";
import { visibleCategories, type CategoryCounts } from "@/lib/catalog/categories";
import { FooterContact } from "./footer-contact";
import { Logo } from "./logo";

export function Footer({ counts }: { counts: CategoryCounts }) {
  const shop = [{ label: "All jerseys", href: "/shop" }, ...visibleCategories(counts)];
  const help = [
    { label: "Track order", href: "/track" },
    { label: "Size guide", href: "/size-guide" },
    { label: "Shipping", href: "/shipping" },
    { label: "Returns & exchanges", href: "/returns" },
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ];
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-step-n1 text-ink-muted">
            The definitive archive of football heritage. Curated jerseys, authenticated craft, delivered with the gravity they deserve.
          </p>
        </div>
        <FooterColumn title="Shop" links={shop} />
        <FooterColumn title="Help" links={help} />
        <FooterContact />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-line px-4 py-6 text-step-n2 text-ink-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 KITTORA. All rights reserved.</p>
        <p>Pay securely by UPI · Delivered across India</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="font-heading text-step-n1 font-semibold text-ink">{title}</h2>
      <ul className="mt-4 grid gap-2.5 text-step-n1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-ink-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
