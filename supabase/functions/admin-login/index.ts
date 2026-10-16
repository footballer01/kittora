// POST { username, password } → { session: { access_token, refresh_token }, mfa } | { error }
//
// The only way admins sign in. Counts every attempt first (admin_login_begin():
// 5 per 15 min per IP + username, 20 per 15 min per IP), maps the username to
// the account's random sign-in email with the service role, then signs in with
// the public key. Every failure gets the same "invalid" answer, and unknown
// usernames still attempt a sign-in, so neither the reply nor its timing shows
// whether a username exists. If the admin has turned on two-factor, the session
// returned here is aal1: is_admin() stays false until the browser verifies a
// TOTP code with Supabase Auth.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { cors, json } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username.trim().slice(0, 64) : "";
    password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!username || !password) return json({ error: "invalid" }, 400);

  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);
  const begin = await service.rpc("admin_login_begin", { p_username: username, p_ip: clientIp(req) });
  if (begin.error) {
    console.error("admin_login_begin failed", begin.error.message);
    return json({ error: "server_error" }, 500);
  }
  if (!begin.data?.allowed) return json({ error: "rate_limited" }, 429);

  const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, opts);
  const email = begin.data.email ?? `nobody-${crypto.randomUUID()}@admin.kittora.internal`;
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await service.rpc("admin_log", { p_actor: null, p_action: "login_failed", p_details: { username: username.toLowerCase().slice(0, 40) } });
    return json({ error: "invalid" }, 401);
  }

  const factors = await auth.auth.mfa.listFactors();
  const mfa = (factors.data?.totp ?? []).some((f) => f.status === "verified");
  await service.rpc("admin_log", { p_actor: data.user.id, p_action: "login", p_details: { mfa } });
  return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token }, mfa });
});
