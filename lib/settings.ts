"use client";

import { useEffect } from "react";
import { create } from "zustand";

// Store settings (admin-edited) and delivery zones, read live with the anon key.
// Everything is optional: empty values hide the matching storefront element.

export type StoreSettings = {
  upiId: string | null;
  payeeName: string | null;
  qrImageUrl: string | null;
  whatsapp: string | null;
  unpaidTimeoutMinutes: number;
  shippingFeePaise: number;
  freeShippingThresholdPaise: number;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  xUrl: string | null;
  policies: Record<PolicyKey, string | null>;
};
export type PolicyKey = "shipping" | "returns" | "terms" | "privacy";
export type DeliveryZone = { name: string; prefix: string; minDays: number; maxDays: number };

export const EMPTY_SETTINGS: StoreSettings = {
  upiId: null,
  payeeName: null,
  qrImageUrl: null,
  whatsapp: null,
  unpaidTimeoutMinutes: 0,
  shippingFeePaise: 0,
  freeShippingThresholdPaise: 0,
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  instagramUrl: null,
  facebookUrl: null,
  youtubeUrl: null,
  xUrl: null,
  policies: { shipping: null, returns: null, terms: null, privacy: null },
};

type Row = {
  upi_id: string | null;
  payee_name: string | null;
  qr_image_path: string | null;
  whatsapp_number: string | null;
  unpaid_timeout_minutes: number;
  shipping_fee_paise: number;
  free_shipping_threshold_paise: number;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  instagram_url: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  shipping_policy?: string | null;
  returns_policy?: string | null;
  terms_text?: string | null;
  privacy_text?: string | null;
};

const text = (s: string | null | undefined) => s?.trim() || null;
// Social links must be https (admins paste them; never render other schemes).
const link = (s: string | null | undefined) => (text(s) && /^https:\/\/[^\s]+$/.test(s!.trim()) ? s!.trim() : null);

export function settingsFromRow(r: Row, supabaseUrl: string): StoreSettings {
  const qr = text(r.qr_image_path);
  return {
    upiId: text(r.upi_id),
    payeeName: text(r.payee_name),
    qrImageUrl: qr ? `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/site-assets/${qr.split("/").map(encodeURIComponent).join("/")}` : null,
    whatsapp: text(r.whatsapp_number),
    unpaidTimeoutMinutes: r.unpaid_timeout_minutes,
    shippingFeePaise: r.shipping_fee_paise,
    freeShippingThresholdPaise: r.free_shipping_threshold_paise,
    contactEmail: text(r.contact_email),
    contactPhone: text(r.contact_phone),
    contactAddress: text(r.contact_address),
    instagramUrl: link(r.instagram_url),
    facebookUrl: link(r.facebook_url),
    youtubeUrl: link(r.youtube_url),
    xUrl: link(r.x_url),
    policies: { shipping: text(r.shipping_policy), returns: text(r.returns_policy), terms: text(r.terms_text), privacy: text(r.privacy_text) },
  };
}

type State = { status: "idle" | "loading" | "ready" | "off"; settings: StoreSettings; zones: DeliveryZone[] };
export const useSettings = create<State>(() => ({ status: "idle", settings: EMPTY_SETTINGS, zones: [] }));

export async function loadSettings() {
  if (useSettings.getState().status !== "idle") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    useSettings.setState({ status: "off" });
    return;
  }
  useSettings.setState({ status: "loading" });
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const [s, z] = await Promise.all([
      supabase().from("settings").select("*").maybeSingle(),
      supabase().from("delivery_zones").select("name, pincode_prefix, min_days, max_days"),
    ]);
    if (s.error) throw s.error;
    useSettings.setState({
      status: "ready",
      settings: s.data ? settingsFromRow(s.data as Row, url) : EMPTY_SETTINGS,
      zones: ((z.data ?? []) as { name: string; pincode_prefix: string; min_days: number; max_days: number }[]).map((r) => ({
        name: r.name,
        prefix: r.pincode_prefix,
        minDays: r.min_days,
        maxDays: r.max_days,
      })),
    });
  } catch {
    useSettings.setState({ status: "off" });
  }
}

/** Settings for a client component; loads once per page. */
export function useStoreSettings() {
  const state = useSettings();
  useEffect(() => {
    void loadSettings();
  }, []);
  return state;
}
