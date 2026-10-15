import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Session pooler (port 5432). Run from a developer machine or CI only.
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT! },
  strict: true,
  verbose: true,
});
