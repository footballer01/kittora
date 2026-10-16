// Drains email_queue: order placed, payment confirmed, packed, shipped,
// delivered and cancelled.
//
// Sends through Gmail SMTP on port 465 (Supabase blocks 25 and 587) when the
// GMAIL_USER and GMAIL_APP_PASSWORD secrets exist; otherwise marks each email
// "skipped" and logs it, so orders never depend on email. Failures retry with
// backoff (claim_emails() hands each row to one run only), up to 5 attempts.
//
// Invoked by a database webhook on email_queue inserts (README "Order email"),
// with the service-role key as the bearer token. SITE_URL is used for links.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import nodemailer from "npm:nodemailer@6.9.16";
import { json } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;

type Payload = {
  number: string;
  name: string;
  total_paise: number;
  shipping_paise: number;
  tracking_note?: string | null;
  items: { name: string; size: string; qty: number; unit_price_paise: number }[];
};
type Kind = "order_placed" | "payment_confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
type Row = { id: string; kind: Kind; to_email: string; payload: Payload; attempts: number };

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function compose(row: Row, site: string) {
  const p = row.payload;
  const track = `${site}/track?n=${encodeURIComponent(p.number)}`;
  const lead = {
    order_placed: `Thanks for your order, ${p.name}. Pay ${rupees(p.total_paise)} by UPI to confirm it: ${site}/order/${p.number}/pay`,
    payment_confirmed: `We've confirmed your payment of ${rupees(p.total_paise)}. We're getting your order ready.`,
    packed: `Your order is packed and will be handed to the courier soon.`,
    shipped: `Your order is on its way.${p.tracking_note ? ` Tracking: ${p.tracking_note}` : ""}`,
    delivered: `Your order has been delivered. Enjoy the shirt!`,
    cancelled: `Your order ${p.number} has been cancelled. If you already paid, reply to this email or message us on WhatsApp.`,
  }[row.kind];
  const subject = {
    order_placed: `Order ${p.number} received`,
    payment_confirmed: `Payment confirmed for order ${p.number}`,
    packed: `Order ${p.number} is packed`,
    shipped: `Order ${p.number} has shipped`,
    delivered: `Order ${p.number} delivered`,
    cancelled: `Order ${p.number} cancelled`,
  }[row.kind];
  const lines = p.items.map((i) => `${i.qty} × ${i.name} (size ${i.size}) — ${rupees(i.unit_price_paise * i.qty)}`);
  const text = [lead, "", ...lines, p.shipping_paise ? `Shipping — ${rupees(p.shipping_paise)}` : "", `Total — ${rupees(p.total_paise)}`, "", `Track your order: ${track}`]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#111">
<p>${esc(lead)}</p><table style="width:100%;border-collapse:collapse">${p.items
    .map((i) => `<tr><td style="padding:4px 0">${i.qty} × ${esc(i.name)} (size ${esc(i.size)})</td><td style="text-align:right">${rupees(i.unit_price_paise * i.qty)}</td></tr>`)
    .join("")}${p.shipping_paise ? `<tr><td>Shipping</td><td style="text-align:right">${rupees(p.shipping_paise)}</td></tr>` : ""}
<tr><td style="padding-top:8px;font-weight:700">Total</td><td style="padding-top:8px;text-align:right;font-weight:700">${rupees(p.total_paise)}</td></tr></table>
<p><a href="${esc(track)}">Track order ${esc(p.number)}</a></p></div>`;
  return { subject, text, html };
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("authorization") !== `Bearer ${serviceKey}`) return json({ error: "unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("claim_emails", { p_limit: 20 });
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as Row[];

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  if (!user || !pass) {
    for (const r of rows) {
      console.log(`email skipped (no Gmail secrets): ${r.kind} for order ${r.payload.number}`);
      await db.from("email_queue").update({ status: "skipped", last_error: "Gmail secrets not set" }).eq("id", r.id);
    }
    return json({ skipped: rows.length });
  }

  const smtp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  let sent = 0;
  for (const r of rows) {
    try {
      const { subject, text, html } = compose(r, site);
      await smtp.sendMail({ from: `KITTORA <${user}>`, to: r.to_email, subject, text, html });
      await db.from("email_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", r.id);
      sent++;
    } catch (e) {
      const failed = r.attempts >= MAX_ATTEMPTS;
      const next = new Date(Date.now() + 2 ** r.attempts * 60_000).toISOString();
      await db
        .from("email_queue")
        .update({ status: failed ? "failed" : "pending", last_error: String((e as Error).message).slice(0, 500), next_attempt_at: next })
        .eq("id", r.id);
    }
  }
  return json({ sent, claimed: rows.length });
});
