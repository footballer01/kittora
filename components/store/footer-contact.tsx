"use client";

import { whatsappLink } from "@/lib/checkout/upi";
import { useStoreSettings } from "@/lib/settings";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/icons";

/** Contact details from admin Settings, loaded live; empty ones are hidden. */
export function FooterContact() {
  const { settings: s } = useStoreSettings();
  if (!s.whatsapp && !s.contactEmail && !s.contactPhone && !s.instagramUrl && !s.contactAddress) return null;
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
        {s.instagramUrl && /^https:\/\//.test(s.instagramUrl) && (
          <li>
            <a href={s.instagramUrl} rel="noopener" className="inline-flex items-center gap-2 hover:text-ink">
              <InstagramIcon width={18} height={18} /> Instagram
            </a>
          </li>
        )}
        {s.contactAddress && <li className="whitespace-pre-line">{s.contactAddress}</li>}
      </ul>
    </div>
  );
}
