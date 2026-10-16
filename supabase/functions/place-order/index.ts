// POST { customer, items, turnstileToken } → { order } | { error, detail? }
//
// Verifies Cloudflare Turnstile, then calls place_order() with the service
// role, passing the client IP for the unpaid-orders-per-IP cap. place_order()
// re-prices everything from the database; prices sent here are ignored.
//
// Secrets: TURNSTILE_SECRET_KEY (required in production; without it the check
// is skipped and logged). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { cors, json } from "../_shared/cors.ts";

const KNOWN = new Set([
  "invalid_name", "invalid_phone", "invalid_email", "invalid_address", "invalid_city", "invalid_state",
  "invalid_pincode", "invalid_items", "quantity_limit", "unavailable", "out_of_stock", "too_many_unpaid", "rate_limited",
]);

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
}

async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY is not set: skipping the bot check (set it before launch)");
    return true;
  }
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = (await res.json()) as { success?: boolean };
  return out.success === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { customer?: unknown; items?: unknown; turnstileToken?: unknown };
  try {
    const text = await req.text();
    if (text.length > 20_000) return json({ error: "invalid_items" }, 400);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_items" }, 400);
  }
  if (!body || typeof body.customer !== "object" || !Array.isArray(body.items)) return json({ error: "invalid_items" }, 400);

  const ip = clientIp(req);
  if (!(await turnstileOk(body.turnstileToken, ip))) return json({ error: "bot_check_failed" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("place_order", { p_customer: body.customer, p_items: body.items, p_ip: ip });
  if (error) {
    if (KNOWN.has(error.message)) return json({ error: error.message, detail: error.details ?? undefined }, 409);
    console.error("place_order failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }
  return json({ order: data });
});
