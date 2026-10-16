"use client";

import { whatsappLink } from "@/lib/checkout/upi";
import { useStoreSettings } from "@/lib/settings";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/icons";

/** Contact details from admin Settings, loaded live; empty ones are hidden. */
export function FooterContact() {
  const { settings: s } = useStoreSettings();
  const socials = [
    { label: "Instagram", href: s.instagramUrl },
    { label: "Facebook", href: s.facebookUrl },
    { label: "YouTube", href: s.youtubeUrl },
    { label: "X", href: s.xUrl },
  ].filter((x): x is { label: string; href: string } => !!x.href);
  if (!s.whatsapp && !s.contactEmail && !s.contactPhone && !socials.length && !s.contactAddress) return null;
  return (
    <div>
      <h2 className="font-heading text-step-n1 font-semibold text-ink">Contact</h2>
      <ul className="mt-4 grid gap-3 text-step-n1 text-ink-muted">
        {s.whatsapp && (
          <li>
            <a href={whatsappLink(s.whatsapp, "Hi KITTORA")} className="inline-flex items-center gap-2 hover:text-ink">
              <WhatsAppIcon width={18} height={18} /> WhatsApp {s.whatsapp}
            </a>
          </li>
        )}
        {s.contactPhone && (
          <li>
            <a href={`tel:${s.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-ink">
              {s.contactPhone}
            </a>
          </li>
        )}
        {s.contactEmail && (
          <li>
            <a href={`mailto:${s.contactEmail}`} className="hover:text-ink">
              {s.contactEmail}
            </a>
          </li>
        )}
        {socials.map((x) => (
          <li key={x.label}>
            <a href={x.href} rel="noopener" className="inline-flex items-center gap-2 hover:text-ink">
              {x.label === "Instagram" && <InstagramIcon width={18} height={18} />} {x.label}
            </a>
          </li>
        ))}
        {s.contactAddress && <li className="whitespace-pre-line">{s.contactAddress}</li>}
      </ul>
    </div>
  );
}
