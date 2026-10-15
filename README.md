# Kittora

Football jerseys for fans in India, curated like museum pieces. This is the owned
codebase for the store currently published as **Terrace Archive**.

**Status:** Phase 0 (skeleton). The catalogue, checkout and admin areas arrive in later phases.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4 |
| Hosting | Cloudflare Workers free plan via `@opennextjs/cloudflare`, on a `workers.dev` subdomain |
| Data | Supabase free plan: Postgres, Auth and Storage, with row-level security on every table |
| ORM | Drizzle (schema and migrations in `drizzle/`) |
| Payments | Razorpay Checkout and webhook, plus optional COD |
| Email | Gmail SMTP sent from a Supabase Edge Function through an `email_queue` table |
| Tests | Vitest (logic) and Playwright (flows) |
| CI | GitHub Actions: gitleaks, typecheck, lint, unit, worker-size budget, e2e |

### Zero running cost

Every service runs on a free tier that allows commercial use. The only costs are
Razorpay's per-payment fee and, later, a custom domain. Before adding any service, check
that its free tier covers us. If it doesn't, raise it rather than adding it.

Free-plan limits that shape the code:

- **Worker size ≤ 3 MiB gzip.** CI fails above 2.8 MiB (`npm run size:check`).
  Next.js alone is about 1.05 MiB, so keep dependencies light and lazy-load admin code.
- **Worker CPU time is short on the free plan.** Prerender pages wherever possible and
  keep per-request work small.
- **No R2 and no Cloudflare Images.** The incremental cache is the read-only
  static-assets cache, so pages are prerendered at build time. Product images are
  compressed in admin when uploaded (at most about 1600px, WebP, under 250 KB), stored in
  Supabase Storage, and served through a custom `next/image` loader.
- **Supabase free projects pause after 7 days without activity.** The `keepalive`
  workflow queries both databases daily.
- **Next 16 Cache Components are off.** They hang in the Workers runtime under the
  current adapter. Recheck when `@opennextjs/cloudflare` is upgraded.

## Getting started

Requirements: Node 24+ and npm.

```bash
npm install
cp .env.example .env.local   # fill in staging values, see "Environment"
npm run dev                  # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run typecheck` / `lint` / `test` | Static checks and unit tests |
| `npm run test:e2e` | Playwright against a production build (390px and 1440px) |
| `npm run preview` | Build the Worker and run it locally in the real Workers runtime |
| `npm run size:check` | Fails if the compressed Worker is over 2.8 MiB (run after `build:worker`) |
| `npm run db:generate` / `db:migrate` | Drizzle migrations (uses `DATABASE_URL_DIRECT`) |

## Environment

There are two Supabase projects, both on the free plan:

- **staging** is used for local development, CI and tests.
- **live** is used only by the deployed site.

| Where | What |
| --- | --- |
| `.env.local` (never committed) | Everything in `.env.example`, using staging values |
| Cloudflare Worker secrets (`npx wrangler secret put NAME`) | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| GitHub repo **variables** (public values) | `DEPLOY_ENABLED`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` |
| GitHub repo **secrets** | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LIVE_DATABASE_URL`, `STAGING_DATABASE_URL` |
| Supabase Edge Function secrets | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |

Admin usernames and passwords are read only by the seed script, from `.env.local`.
They never appear in code or git.

The Supabase anon key and URL are public by design. Security comes from RLS and
server-side checks, never from hiding code.

## Deploying

1. Create a free Cloudflare account. Under **Workers & Pages**, claim a `workers.dev` subdomain.
2. Create an API token using the "Edit Cloudflare Workers" template. Add it to the
   GitHub repo secrets as `CLOUDFLARE_API_TOKEN`, along with `CLOUDFLARE_ACCOUNT_ID`.
3. Set the Worker secrets listed above, using live values:
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (and the others).
4. Add the GitHub repo variables listed above, then set `DEPLOY_ENABLED=true`.
5. Every push to `main` now deploys. You can also run **Actions → Deploy → Run workflow**.
6. Turn on Cloudflare Web Analytics for the site and put the token in
   `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`.

### Keepalive caveat

GitHub disables scheduled workflows in a public repo after 60 days with no commits. If
the repo goes quiet for that long, re-enable **Keep Supabase awake** in the Actions tab.

## Order email (Gmail)

Workers can't open SMTP connections, so email goes through a Supabase Edge Function.
The order flow writes rows to `email_queue`, and the function sends them and retries
failures with backoff, so hitting Gmail's daily limit never fails an order. Until the
Gmail secrets exist, emails are skipped and logged, and the site works normally.

Supabase blocks outgoing ports 25 and 587 from Edge Functions, so the function uses
`smtp.gmail.com:465` (implicit SSL).

1. Create or choose the store's Gmail account and turn on 2-Step Verification.
2. Go to Google Account → Security → **App passwords** and create one called "Kittora".
3. Store the secrets on **both** Supabase projects:
   ```bash
   supabase secrets set GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx --project-ref <ref>
   ```

### Supabase Auth email (customer sign-in codes)

Supabase's built-in mailer is for testing only and sends very few messages, so set up
custom SMTP before launch:

1. In Supabase, go to **Authentication → Emails → SMTP Settings → Enable custom SMTP**.
2. Use host `smtp.gmail.com`, port `465`, your Gmail address as the username, and the
   app password. Set the sender to the same Gmail address with the name "Kittora".
3. Repeat on the staging project, or use a second Gmail account for it.

## Adding a custom domain later

1. Buy the domain from any registrar. Then either add it to Cloudflare (free plan) and
   switch the nameservers to Cloudflare's, or register it at Cloudflare.
2. Go to **Workers & Pages → kittora → Settings → Domains & Routes → Add → Custom domain**.
3. Update the repo variable `NEXT_PUBLIC_SITE_URL` and redeploy.
4. Update the Supabase **Auth → URL configuration** (site URL and redirect URLs), the
   Razorpay webhook URL and the Google OAuth redirect URIs.
5. Optionally, move order email to a domain sender, for example a free tier of an
   email-sending service. That means verifying the domain's SPF/DKIM records and swapping
   the Edge Function's transport.

## Repository security

This repo is public:

- Secret scanning and push protection are on (Settings → Code security).
- gitleaks runs on every PR and every push.
- Never commit `.env*` (except `.env.example`), customer data, admin usernames or
  private planning notes. `.gitignore` covers `BRIEF.md` and `*.brief.md`.
