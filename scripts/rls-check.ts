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
