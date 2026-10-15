import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db/client";

// Pinged daily by .github/workflows/keepalive.yml so the free Supabase
// project never pauses for inactivity. Reveals nothing beyond up/down.
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
