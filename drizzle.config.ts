import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// DB_TARGET=STAGING (default) or LIVE picks <TARGET>_DATABASE_URL_DIRECT
// (Supabase session pooler, port 5432). Run from a developer machine or CI only.
const target = (process.env.DB_TARGET ?? "STAGING").toUpperCase();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env[`${target}_DATABASE_URL_DIRECT`] ?? "" },
  // Supabase manages its own roles (anon, authenticated…); don't create them.
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
