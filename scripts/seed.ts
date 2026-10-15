// Seed a Supabase project from the v1 import: migrations, images, products,
// variants and the three admin accounts, then verify RLS with the anon key.
// Idempotent: re-runs update rows and overwrite images, never duplicate.
//
//   npm run seed -- --target staging     (always run staging first)
//   npm run seed -- --target live
//
// Re-running updates only fields that came from v1 (name, price, SKU…). Fields
// admins fill in (player, number, season, kit type, fit, stock) are never touched.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { adminEmail } from "@/lib/admin";
import { runRlsChecks } from "./rls-check";

config({ path: ".env.local", quiet: true });

const IMPORT_DIR = join(process.cwd(), "scripts/import");
const BUCKET = "product-images";
const MIN_PASSWORD_LENGTH = 12;

type ImportedProduct = {
  v1Id: string;
  slug: string;
  name: string;
  club: string | null;
  country: string | null;
  pricePaise: number | null;
  sku: string | null;
  audience: ("men" | "women" | "kids")[];
  featuredOnHome: boolean;
  homePosition: number | null;
  sizes: { label: string }[];
  description: string | null;
  images: { file: string | null; alt: string; width: number | null; height: number | null }[];
};
type ManifestEntry = { original: string; webp: string; width: number; height: number; bytes: number };

function parseTarget(): "STAGING" | "LIVE" {
  const i = process.argv.indexOf("--target");
  const value = (i >= 0 ? process.argv[i + 1] : "").toUpperCase();
  if (value !== "STAGING" && value !== "LIVE") {
    console.error("Usage: npm run seed -- --target staging|live");
    process.exit(2);
  }
  return value;
}

/** Every env var this target needs, without printing any values. */
function requireEnv(target: string) {
  const names = [
    `${target}_SUPABASE_URL`,
    `${target}_SUPABASE_ANON_KEY`,
    `${target}_SUPABASE_SERVICE_ROLE_KEY`,
    `${target}_DATABASE_URL_DIRECT`,
    ...[1, 2, 3].flatMap((n) => [`ADMIN_${n}_USERNAME`, `ADMIN_${n}_PASSWORD`]),
  ];
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (missing.length) {
    console.error(`Seed blocked — missing in .env.local:\n  ${missing.join("\n  ")}`);
    process.exit(2);
  }
  const weak = [1, 2, 3].filter((n) => process.env[`ADMIN_${n}_PASSWORD`]!.length < MIN_PASSWORD_LENGTH);
  if (weak.length) {
    console.error(`Seed blocked — ADMIN_${weak.join(", ADMIN_")}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(2);
  }
  const env = (n: string) => process.env[`${target}_${n}`]!;
  return { url: env("SUPABASE_URL"), anonKey: env("SUPABASE_ANON_KEY"), serviceKey: env("SUPABASE_SERVICE_ROLE_KEY") };
}

type Result = { data: unknown; error: { message: string } | null };
type Success<R extends Result> = NonNullable<Exclude<R, { error: { message: string } }>["data"]>;

/** Unwrap a Supabase result: throw on error or missing data. */
function must<R extends Result>(result: R, what: string): Success<R> {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${what}: no data returned`);
  return result.data as Success<R>;
}

async function uploadImages(db: SupabaseClient, products: ImportedProduct[], manifest: Map<string, ManifestEntry>) {
  let uploaded = 0;
  const paths = new Map<string, string>(); // original file → storage path
  for (const p of products) {
    for (const [i, img] of p.images.entries()) {
      const m = img.file ? manifest.get(img.file) : undefined;
      if (!m) throw new Error(`No compressed image for ${p.slug} #${i + 1}; run scripts/import/compress-images.ts`);
      const path = `products/${p.slug}/${i + 1}.webp`;
      const body = readFileSync(join(IMPORT_DIR, "images/webp", m.webp));
      must(await db.storage.from(BUCKET).upload(path, body, { contentType: "image/webp", upsert: true, cacheControl: "31536000" }), `upload ${path}`);
      paths.set(img.file!, path);
      uploaded++;
    }
  }
  return { uploaded, paths };
}

async function seedCatalogue(db: SupabaseClient, products: ImportedProduct[], manifest: Map<string, ManifestEntry>, paths: Map<string, string>) {
  const rows = products.map((p) => {
    if (p.pricePaise == null) throw new Error(`${p.slug} has no price`);
    return {
      v1_id: p.v1Id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      club: p.club,
      country: p.country,
      audience: p.audience,
      description: p.description,
      price_paise: p.pricePaise,
      featured: p.featuredOnHome,
      featured_position: p.homePosition,
    };
  });
  const saved = must(await db.from("products").upsert(rows, { onConflict: "v1_id" }).select("id, v1_id"), "upsert products");
  const idByV1 = new Map(saved.map((r: { id: string; v1_id: string }) => [r.v1_id, r.id]));

  const images = products.flatMap((p) =>
    p.images.map((img, i) => {
      const m = manifest.get(img.file!)!;
      return { product_id: idByV1.get(p.v1Id), storage_path: paths.get(img.file!), width: m.width, height: m.height, alt: img.alt, position: i };
    }),
  );
  const imgResult = await db.from("product_images").upsert(images, { onConflict: "product_id,position" });
  if (imgResult.error) throw new Error(`upsert product_images: ${imgResult.error.message}`);

  // Stock is deliberately omitted: v1 shows only "In stock", so it stays null
  // for admins to set, and re-runs never overwrite counts admins entered.
  const variants = products.flatMap((p) => p.sizes.map((s, i) => ({ product_id: idByV1.get(p.v1Id), size: s.label, position: i })));
  const varResult = await db.from("variants").upsert(variants, { onConflict: "product_id,size" });
  if (varResult.error) throw new Error(`upsert variants: ${varResult.error.message}`);
  return { products: saved.length, images: images.length, variants: variants.length };
}

async function findUserByEmail(db: SupabaseClient, email: string) {
  for (let page = 1; page < 50; page++) {
    const { users } = must(await db.auth.admin.listUsers({ page, perPage: 200 }), "list users");
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function seedAdmins(db: SupabaseClient, url: string, anonKey: string) {
  for (const n of [1, 2, 3]) {
    const username = process.env[`ADMIN_${n}_USERNAME`]!.trim();
    const password = process.env[`ADMIN_${n}_PASSWORD`]!;
    const email = adminEmail(username);
    const existing = await findUserByEmail(db, email);
    const user = existing
      ? must(await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true }), `update admin ${n}`).user
      : must(await db.auth.admin.createUser({ email, password, email_confirm: true }), `create admin ${n}`).user;
    const profile = await db.from("profiles").upsert({ id: user.id, role: "admin", username }, { onConflict: "id" });
    if (profile.error) throw new Error(`set admin ${n} profile: ${profile.error.message}`);

    // Confirm the account can actually sign in (as a browser would).
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Admin ${n}: sign-in check failed (${error.message})`);
    const { data: isAdmin } = await client.rpc("is_admin");
    await client.auth.signOut();
    if (isAdmin !== true) throw new Error(`Admin ${n}: signed in but is_admin() is not true`);
    // Never print usernames, emails or passwords: CI logs are public.
    console.log(`  admin ${n}/3: ${existing ? "updated" : "created"}, sign-in OK, is_admin() = true`);
  }
}

async function main() {
  const target = parseTarget();
  const { url, anonKey, serviceKey } = requireEnv(target);

  const productsFile = join(IMPORT_DIR, "products.json");
  const manifestFile = join(IMPORT_DIR, "images/webp/manifest.json");
  for (const f of [productsFile, manifestFile]) {
    if (!existsSync(f)) throw new Error(`Missing ${f}; run the import scripts first (see scripts/import/README.md)`);
  }
  const products = (JSON.parse(readFileSync(productsFile, "utf8")) as { products: ImportedProduct[] }).products;
  const manifest = new Map((JSON.parse(readFileSync(manifestFile, "utf8")) as ManifestEntry[]).map((m) => [m.original, m]));

  console.log(`Seeding ${target}`);
  console.log("1. Migrations");
  execFileSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit", env: { ...process.env, DB_TARGET: target } });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log("2. Images");
  const { uploaded, paths } = await uploadImages(db, products, manifest);
  console.log(`  ${uploaded} product images uploaded to ${BUCKET}`);

  console.log("3. Catalogue");
  const counts = await seedCatalogue(db, products, manifest, paths);
  console.log(`  ${counts.products} products, ${counts.images} images, ${counts.variants} variants`);

  console.log("4. Admin accounts");
  await seedAdmins(db, url, anonKey);

  console.log("5. RLS checks (anon key)");
  const failures = await runRlsChecks(url, anonKey);
  if (failures > 0) {
    console.error(`✗ ${failures} RLS check(s) failed on ${target}`);
    process.exit(1);
  }
  console.log(`✓ ${target} seeded`);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
