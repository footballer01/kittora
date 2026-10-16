// Minimal stand-in for the parts of Supabase our migrations touch, so the real
// migration files can run against PGlite (in-memory Postgres) in tests.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const STUB = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;

CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE);
-- Supabase reads the caller from the JWT; tests set request.jwt.claim.sub.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
`;

export async function freshDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  const dir = join(process.cwd(), "drizzle");
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(dir, `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.exec(statement);
    }
  }
  return db;
}

/** Run `fn` as a Supabase role, optionally as a specific signed-in user. */
export async function as<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
  ip = "203.0.113.1",
): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  // PostgREST exposes request headers this way; client_ip() reads them.
  await db.query(`SELECT set_config('request.headers', $1, false)`, [JSON.stringify({ "cf-connecting-ip": ip })]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`SELECT set_config('request.headers', '', false)`);
  }
}
