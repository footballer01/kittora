# Kittora

Football jerseys for fans in India, curated like museum pieces. This is the owned
codebase for the store currently published as **Terrace Archive**.

**Status:** Phase 0.5 — v1 imported (13 products, theme, copy, baseline). Database schema, RLS and seed are ready; Supabase projects not yet created. Catalogue, checkout and admin arrive in later phases.

## How it works

```
GitHub (public repo) ──push / "Publish changes"──▶ GitHub Actions: next build ──▶ Cloudflare static assets
                                                         │ reads catalogue                │
                                                         ▼                                ▼
                                                   Supabase ◀───── browser (anon key) ── customers & admins
                                       Postgres + RLS · Auth · Storage · Edge Functions
```

- **The site is fully static.** `next build` with `output: "export"` writes plain files
  to `out/`, and Cloudflare serves them. No server code runs on Cloudflare.
- **Catalogue pages are pre-built at deploy time,** which keeps them fast and good for
  SEO. Price and stock load live in the browser, so they're never stale.
- **Supabase is the whole back end.** The browser holds only the anon key:
  - RLS is on every table.
  - Orders are created only through the `place_order` SECURITY DEFINER function, which
    re-prices from the database and reserves stock.
  - Customers read their own order only through a function that takes the order number
    and phone.
  - Only the admin role can write.
- **Edge Functions** send order email, and the admin's **Publish changes** button
  re-deploys the site after catalogue edits.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, static export), TypeScript strict, Tailwind CSS v4 |
| Hosting | Cloudflare Workers static assets, free and assets-only, on a `workers.dev` subdomain |
| Back end | Supabase free plan: Postgres, Auth, Storage and Edge Functions |
| Schema | Drizzle: schema and migrations in `drizzle/`, including RLS and SQL functions |
| Payments | UPI: QR code or UPI-app link, then the customer submits the UTR and an admin verifies it |
| Email | Gmail SMTP from an Edge Function, through an `email_queue` table |
| Tests | Vitest (logic) and Playwright (flows) |
| CI | GitHub Actions: gitleaks, typecheck, lint, unit tests, e2e |

### Zero running cost

Every service runs on a free tier that allows commercial use. The only possible cost is
a custom domain later. Before adding any service, check that its free tier covers us. If
it doesn't, raise it rather than adding it.

The site isn't on GitHub Pages because GitHub's terms don't allow e-commerce there. The
code lives on GitHub, and Cloudflare serves the site.

## Getting started

Requirements: Node 24+ and npm.

```bash
npm install
cp .env.example .env.local   # fill in STAGING values
npm run dev                  # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run typecheck` / `lint` / `test` | Static checks and unit tests |
| `npm run test:e2e` | Builds the static site and runs Playwright against it at 390px and 1440px |
| `npm run preview` | Builds and serves `out/` locally exactly as Cloudflare will |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` / `db:migrate:live` | Apply migrations to staging / live |
| `npm run seed -- --target staging\|live` | Migrate, upload images, upsert products and variants, create admins, run RLS checks |
| `npm run rls:check -- --target staging\|live` | Probe a project with the anon key: catalogue readable, nothing writable, orders hidden |
| `npm run import:*` | Re-run the v1 import (see `scripts/import/README.md`) |

## Setting up Supabase

1. Create two free projects at supabase.com, **kittora-staging** and **kittora-live**,
   in the Mumbai region (ap-south-1).
2. For each project, copy these into `.env.local` as `STAGING_*` / `LIVE_*` (see
   `.env.example`):
   - From **Project Settings → API**: the URL, the `anon` key and the `service_role` key.
   - From **Connect → Session pooler**: the connection string (port 5432), with the
     database password filled in.
3. Fill in `ADMIN_1..3_USERNAME` and `ADMIN_1..3_PASSWORD`. Passwords must be at least
   12 characters.
4. Run `npm run seed -- --target staging`, check it, then `npm run seed -- --target live`.

Re-running the seed updates only v1-sourced fields (name, price, SKU, club,
description, images). It never touches what admins fill in: player, number, season,
kit type, fit and stock.

The migrations and RLS rules are also tested in CI against an in-memory Postgres
(`tests/db/`), so policy changes are checked on every PR.

## Environment

There are two Supabase projects, both on the free plan:

- **staging** is used for local development, CI and tests.
- **live** is used only by the deployed site.

| Where | What |
| --- | --- |
| `.env.local` (never committed) | Everything in `.env.example`: `NEXT_PUBLIC_*` with staging values, plus `STAGING_*` and `LIVE_*` for scripts |
| GitHub repo **variables** (public values) | `DEPLOY_ENABLED`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` |
| GitHub repo **secrets** | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LIVE_DATABASE_URL`, `STAGING_DATABASE_URL` |
| Supabase Edge Function secrets | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GITHUB_DEPLOY_TOKEN`, `GITHUB_REPO` |

- **The service-role keys never ship to the browser.** They are used only by local
  scripts (migrations, seed) and live in `.env.local`.
- **Admin usernames and passwords are never committed.** They are read only by the seed
  script. Each admin signs in through Supabase Auth with a placeholder address of the
  form `<username>@admin.kittora.internal`.
- **The anon key and Supabase URL are public by design.** Security comes from RLS and
  Postgres functions, never from hiding code.

## Deploying

1. Create a free Cloudflare account. Under **Workers & Pages**, claim a `workers.dev` subdomain.
2. Create an API token using the "Edit Cloudflare Workers" template. Add it to the
   GitHub repo secrets as `CLOUDFLARE_API_TOKEN`, along with `CLOUDFLARE_ACCOUNT_ID`.
3. Add the GitHub repo variables listed above (live values), then set `DEPLOY_ENABLED=true`.
4. Every push to `main` now deploys. You can also run **Actions → Deploy → Run workflow**,
   or use **Publish changes** in admin.
5. Turn on Cloudflare Web Analytics for the site and put the token in
   `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`.

### The "Publish changes" button

Admin edits to the catalogue (names, images, new products) reach the pre-built pages
only after a rebuild. Price and stock changes show immediately. To set the button up:

1. On GitHub, create a **fine-grained personal access token**:
   - Repository access: *Only select repositories* → this repo.
   - Permissions: *Actions → Read and write*. Nothing else.
2. Store it on the live Supabase project:
   ```bash
   supabase secrets set GITHUB_DEPLOY_TOKEN=github_pat_... GITHUB_REPO=<owner>/kittora --project-ref <live-ref>
   ```
3. The `publish` Edge Function checks that the caller is an admin before it dispatches
   `deploy.yml`.

Fine-grained tokens expire, so set a calendar reminder to rotate it.

### Keeping Supabase awake

Free Supabase projects pause after 7 days without activity. Customer traffic keeps the
live project active. As a backup, the **Keep Supabase awake** workflow queries both
projects every day. GitHub turns off scheduled workflows in a public repo after 60 days
with no commits. If that happens, re-enable the workflow in the Actions tab.

## Order email (Gmail)

New orders and status changes add rows to `email_queue`. A database webhook calls the
`send-email` Edge Function, which sends each row and retries failures with backoff, so
hitting Gmail's daily limit never fails an order. Until the Gmail secrets exist, emails
are skipped and logged, and the site works normally.

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
4. Update the Supabase **Auth → URL configuration** (site URL and redirect URLs) and the
   Google OAuth redirect URIs.
5. Optionally, move order email to a domain sender. That means verifying the domain's
   SPF/DKIM records and swapping the Edge Function's transport.

## Repository security

This repo is public:

- Secret scanning and push protection are on (Settings → Code security).
- gitleaks runs on every PR and every push.
- Never commit `.env*` (except `.env.example`), customer data, admin usernames or
  private planning notes. `.gitignore` covers `BRIEF.md`, `*.brief.md` and `CLAUDE.local.md`.

---

Copyright © 2026 KITTORA. All rights reserved.
