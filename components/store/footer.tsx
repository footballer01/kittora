import Link from "next/link";
import { visibleCategories, type CategoryCounts } from "@/lib/catalog/categories";
import { InstagramIcon, ShieldIcon, ReturnIcon, TruckIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Logo } from "./logo";

/** Contact details come from admin Settings (Phase 5); empty ones are hidden. */
export type FooterContact = { whatsapp?: string | null; email?: string | null; instagram?: string | null };

const TRUST = [
  { icon: ShieldIcon, title: "Authenticated craft", body: "Every jersey verified for authenticity and quality." },
  { icon: TruckIcon, title: "Pan-India delivery", body: "Secure shipping to your doorstep, tracked end to end." },
  { icon: ReturnIcon, title: "Easy returns", body: "Seven-day hassle-free returns on unworn jerseys." },
];

export function Footer({ counts, contact = {} }: { counts: CategoryCounts; contact?: FooterContact }) {
  const shop = [{ label: "All jerseys", href: "/shop" }, ...visibleCategories(counts)];
  const help = [
    { label: "Track order", href: "/track" },
    { label: "Size guide", href: "/size-guide" },
    { label: "Shipping", href: "/shipping" },
    { label: "Returns & exchanges", href: "/returns" },
    { label: "Contact", href: "/contact" },
  ];
  const wa = contact.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="mt-auto border-t border-line bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-6 border-b border-line px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
        {TRUST.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <Icon />
            </span>
            <div>
              <p className="font-heading font-semibold text-ink">{title}</p>
              <p className="text-step-n1 text-ink-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-step-n1 text-ink-muted">
            The definitive archive of football heritage. Curated jerseys, authenticated craft, delivered with the gravity they deserve.
          </p>
        </div>
        <FooterColumn title="Shop" links={shop} />
        <FooterColumn title="Help" links={help} />
        {(wa || contact.email || contact.instagram) && (
          <div>
            <h2 className="font-heading text-step-n1 font-semibold text-ink">Contact</h2>
            <ul className="mt-4 grid gap-3 text-step-n1">
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} className="inline-flex items-center gap-2 text-ink-muted hover:text-ink">
                    <WhatsAppIcon width={18} height={18} /> WhatsApp {contact.whatsapp}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="text-ink-muted hover:text-ink">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.instagram && (
                <li>
                  <a href={contact.instagram} className="inline-flex items-center gap-2 text-ink-muted hover:text-ink">
                    <InstagramIcon width={18} height={18} /> Instagram
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
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
