"use client";

// Browser calls for checkout, payment and tracking. Only the public key is
// used; all checks and prices live in Postgres (drizzle/0008_checkout_functions.sql).
import type { CheckoutValues } from "./form";

export type OrderStatus = "awaiting_payment" | "payment_submitted" | "paid" | "packed" | "shipped" | "delivered" | "cancelled";

export type PublicOrder = {
  number: string;
  status: OrderStatus;
  name: string;
  city: string;
  state: string;
  pincode: string;
  subtotal_paise: number;
  shipping_paise: number;
  total_paise: number;
  utr_submitted: boolean;
  created_at: string;
  expires_at: string | null;
  upload_key: string | null;
  items: { slug: string; name: string; size: string; qty: number; unit_price_paise: number }[];
  events: { status: OrderStatus; at: string }[];
};

export type ApiError = { code: string; message: string; detail?: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const MESSAGES: Record<string, string> = {
  not_configured: "Ordering isn't switched on yet. Please message us on WhatsApp to order.",
  network: "We couldn't reach the store. Check your connection and try again.",
  server_error: "Something went wrong on our side. Please try again in a minute.",
  bot_check_failed: "Please complete the security check and try again.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  too_many_unpaid: "You already have unpaid orders. Please pay for or wait out those first.",
  quantity_limit: "One of your items is over the quantity limit.",
  out_of_stock: "Some sizes in your cart just sold out. We've updated your cart.",
  unavailable: "An item in your cart is no longer available. We've updated your cart.",
  invalid_items: "Your cart couldn't be read. Please review it and try again.",
  invalid_phone: "Enter a 10-digit Indian mobile number.",
  invalid_pincode: "Enter a 6-digit pincode.",
  invalid_email: "Enter a valid email, or leave it empty.",
  invalid_utr: "Enter the UPI reference (UTR) from your payment app.",
  invalid_proof: "The screenshot didn't upload. Please try again.",
  not_found: "We couldn't find an order with that number and phone.",
  not_awaiting_payment: "This order isn't waiting for payment any more.",
  upload_failed: "The screenshot didn't upload. Try a smaller image, or submit without it.",
};
export const errorMessage = (code: string) => MESSAGES[code] ?? (code.startsWith("invalid_") ? "Please check your details." : MESSAGES.server_error);
const fail = (code: string, detail?: string): { ok: false; error: ApiError } => ({ ok: false, error: { code, message: errorMessage(code), detail } });

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function client() {
  const { supabase } = await import("@/lib/supabase/client");
  return supabase();
}

/** Postgres raises our short codes as the error message. */
const codeOf = (e: { message?: string } | null) => (e?.message && /^[a-z_]+$/.test(e.message) ? e.message : "server_error");

export async function placeOrder(
  customer: CheckoutValues,
  items: { slug: string; size: string; qty: number }[],
  turnstileToken: string | null,
): Promise<Result<PublicOrder>> {
  if (!configured()) return fail("not_configured");
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/place-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      body: JSON.stringify({ customer, items, turnstileToken }),
    });
    const body = (await res.json().catch(() => ({}))) as { order?: PublicOrder; error?: string; detail?: string };
    if (body.order) return { ok: true, data: body.order };
    return fail(body.error ?? "server_error", body.detail);
  } catch {
    return fail("network");
  }
}

export async function trackOrder(number: string, phone: string): Promise<Result<PublicOrder | null>> {
  if (!configured()) return fail("not_configured");
  try {
    const { data, error } = await (await client()).rpc("track_order", { p_number: number, p_phone: phone });
    if (error) return fail(codeOf(error));
    return { ok: true, data: (data as PublicOrder | null) ?? null };
  } catch {
    return fail("network");
  }
}

export async function uploadProof(uploadKey: string, file: File): Promise<Result<string>> {
  if (!configured()) return fail("not_configured");
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" } as Record<string, string>)[file.type] ?? "img";
  const path = `${uploadKey}/${crypto.randomUUID()}.${ext}`;
  try {
    const { error } = await (await client()).storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false });
    return error ? fail("upload_failed") : { ok: true, data: path };
  } catch {
    return fail("upload_failed");
  }
}

export async function submitPayment(number: string, phone: string, utr: string, proofPath: string | null): Promise<Result<PublicOrder>> {
  if (!configured()) return fail("not_configured");
  try {
    const { data, error } = await (await client()).rpc("submit_payment", { p_number: number, p_phone: phone, p_utr: utr, p_proof_path: proofPath });
    if (error) return fail(codeOf(error));
    const body = data as PublicOrder | { error: string };
    return "error" in body ? fail(body.error) : { ok: true, data: body };
  } catch {
    return fail("network");
  }
}
