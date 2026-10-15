import "server-only";
import { z } from "zod";

// Server-only environment. Public values (NEXT_PUBLIC_*) are read directly
// where needed so they can be inlined into client bundles.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function serverEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server env: ${missing}`);
  }
  return parsed.data;
}
