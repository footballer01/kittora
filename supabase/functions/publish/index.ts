// POST { action: "publish" | "status" } with the admin's session as the bearer token.
//
// "Publish changes" in admin: dispatches the Deploy workflow (which rebuilds
// the static site from the live catalogue) and reports the latest run. Only
// admins may call it: the caller's own token must pass is_admin() (so a TOTP
// admin needs a verified session). A run already queued or in progress is
// reused instead of starting another.
//
// Secrets: GITHUB_DEPLOY_TOKEN (fine-grained token for this repo only, with
// "Actions: read and write") and GITHUB_REPO ("owner/name").
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { cors, json } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

type Run = { status: string; conclusion: string | null; created_at: string; html_url: string };

async function gh(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${Deno.env.get("GITHUB_REPO")}/actions/workflows/deploy.yml${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${Deno.env.get("GITHUB_DEPLOY_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kittora-publish",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

async function latestRun(): Promise<Run | null> {
  const res = await gh("/runs?per_page=1");
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const body = (await res.json()) as { workflow_runs?: Run[] };
  const r = body.workflow_runs?.[0];
  return r ? { status: r.status, conclusion: r.conclusion, created_at: r.created_at, html_url: r.html_url } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization") ?? "";
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { ...opts, global: { headers: { Authorization: authorization } } });
  const { data: isAdmin } = await user.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "forbidden" }, 403);
  if (!Deno.env.get("GITHUB_DEPLOY_TOKEN") || !Deno.env.get("GITHUB_REPO")) return json({ error: "not_configured" }, 503);

  const action = ((await req.json().catch(() => ({}))) as { action?: string }).action;
  try {
    if (action === "status") return json({ run: await latestRun() });
    if (action !== "publish") return json({ error: "invalid" }, 400);

    const current = await latestRun();
    if (current && (current.status === "queued" || current.status === "in_progress")) return json({ run: current, reused: true });
    const res = await gh("/dispatches", { method: "POST", body: JSON.stringify({ ref: "main", inputs: { reason: "admin publish" } }) });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const { data: u } = await user.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);
    await service.rpc("admin_log", { p_actor: u.user?.id ?? null, p_action: "publish", p_details: null });
    return json({ started: true });
  } catch (e) {
    console.error("publish failed", (e as Error).message);
    return json({ error: "github_error" }, 502);
  }
});
