import { defineConfig, devices } from "@playwright/test";
import { MOCK_SUPABASE_URL } from "./tests/e2e/mock-supabase";

const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Serve the static export exactly as Cloudflare will. Supabase points at a
    // mock (tests/e2e/mock-supabase.ts); the catalogue still builds from the v1 import.
    command: `npm run build && npx wrangler dev --port ${port}`,
    env: { KITTORA_CATALOG: "import", NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key" },
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
