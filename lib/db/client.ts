import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

// Workers can't hold connections between requests, so each request opens a
// small client against Supabase's transaction pooler (port 6543).
// `prepare: false` is required by the pooler in transaction mode.
export function getDb() {
  const sql = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}
