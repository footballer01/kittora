import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The only Supabase client in the app. It uses the public anon key: every read
// and write is governed by RLS and SECURITY DEFINER functions in Postgres.
// The service-role key never appears in this codebase's runtime.
let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
