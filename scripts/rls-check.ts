// Checks a live Supabase project the way an attacker with the public anon key
// would: catalogue readable, nothing writable, orders invisible.
//
//   npx tsx scripts/rls-check.ts --target staging|live
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

type Check = { name: string; run: () => Promise<boolean> };

export async function runRlsChecks(url: string, anonKey: string): Promise<number> {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const blocked = (error: unknown, count?: number | null) => Boolean(error) || count === 0;

  const checks: Check[] = [
    {
      name: "anon can read products",
      run: async () => {
        const { data, error } = await anon.from("products").select("id").limit(1);
        return !error && (data?.length ?? 0) > 0;
      },
    },
    {
      name: "anon can read variants and images",
      run: async () => {
        const v = await anon.from("variants").select("id").limit(1);
        const i = await anon.from("product_images").select("id").limit(1);
        return !v.error && !i.error && (v.data?.length ?? 0) > 0 && (i.data?.length ?? 0) > 0;
      },
    },
    {
      name: "anon cannot insert products",
      run: async () => {
        const { error } = await anon.from("products").insert({ slug: "rls-probe", name: "probe", price_paise: 1 });
        return Boolean(error);
      },
    },
    {
      name: "anon cannot update prices",
      run: async () => {
        const { error, count } = await anon.from("products").update({ price_paise: 1 }, { count: "exact" }).gte("price_paise", 0);
        return blocked(error, count);
      },
    },
    {
      name: "anon cannot delete variants",
      run: async () => {
        const { error, count } = await anon.from("variants").delete({ count: "exact" }).gte("position", 0);
        return blocked(error, count);
      },
    },
    {
      name: "anon cannot read orders",
      run: async () => {
        const { data, error } = await anon.from("orders").select("id").limit(1);
        return Boolean(error) || (data?.length ?? 0) === 0;
      },
    },
    {
      name: "anon cannot read profiles",
      run: async () => {
        const { data, error } = await anon.from("profiles").select("id").limit(1);
        return Boolean(error) || (data?.length ?? 0) === 0;
      },
    },
    {
      name: "anon cannot upload to product-images",
      run: async () => {
        const { error } = await anon.storage
          .from("product-images")
          .upload(`rls-probe-${Date.now()}.webp`, new Blob(["x"], { type: "image/webp" }));
        return Boolean(error);
      },
    },
    {
      name: "anon cannot call place_order (Edge Function only)",
      run: async () => {
        const { error } = await anon.rpc("place_order", { p_customer: {}, p_items: [], p_ip: "" });
        return Boolean(error);
      },
    },
    {
      name: "anon cannot read order items, events or the email queue",
      run: async () => {
        const results = await Promise.all(["order_items", "order_events", "email_queue", "rate_limits"].map((t) => anon.from(t).select("*").limit(1)));
        return results.every((r) => Boolean(r.error) || (r.data?.length ?? 0) === 0);
      },
    },
    {
      name: "anon can read settings but not change them",
      run: async () => {
        const read = await anon.from("settings").select("whatsapp_number").limit(1);
        const write = await anon.from("settings").update({ upi_id: "rls-probe@upi" }, { count: "exact" }).eq("id", true);
        return !read.error && blocked(write.error, write.count);
      },
    },
    {
      name: "track_order hides unknown orders",
      run: async () => {
        const { data, error } = await anon.rpc("track_order", { p_number: "KTRLSPROBE00", p_phone: "9000000000" });
        return !error && data === null;
      },
    },
    {
      name: "anon cannot upload outside an unpaid order's folder",
      run: async () => {
        const { error } = await anon.storage.from("payment-proofs").upload(`${crypto.randomUUID()}/probe.png`, new Blob(["x"], { type: "image/png" }));
        return Boolean(error);
      },
    },
    {
      name: "anon cannot read the admin audit log or call admin functions",
      run: async () => {
        const log = await anon.from("admin_audit_log").select("id").limit(1);
        const dash = await anon.rpc("admin_dashboard");
        const login = await anon.rpc("admin_login_begin", { p_username: "probe", p_ip: "" });
        return (Boolean(log.error) || (log.data?.length ?? 0) === 0) && Boolean(dash.error) && Boolean(login.error);
      },
    },
    {
      name: "anon is not admin",
      run: async () => {
        const { data, error } = await anon.rpc("is_admin");
        return !error && data === false;
      },
    },
  ];

  let failures = 0;
  for (const c of checks) {
    let ok = false;
    try {
      ok = await c.run();
    } catch {
      ok = false;
    }
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.name}`);
  }
  return failures;
}

if (process.argv[1]?.endsWith("rls-check.ts")) {
  config({ path: ".env.local", quiet: true });
  const i = process.argv.indexOf("--target");
  const target = (i >= 0 ? process.argv[i + 1] : "staging").toUpperCase();
  const url = process.env[`${target}_SUPABASE_URL`];
  const key = process.env[`${target}_SUPABASE_ANON_KEY`];
  if (!url || !key) {
    console.error(`Missing ${target}_SUPABASE_URL or ${target}_SUPABASE_ANON_KEY in .env.local`);
    process.exit(2);
  }
  runRlsChecks(url, key).then((f) => process.exit(f ? 1 : 0));
}
