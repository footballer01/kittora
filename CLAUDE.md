@AGENTS.md

# Kittora — working notes for coding agents

This repository is public. Never write secrets, account names, admin usernames,
customer data or private planning notes into tracked files. Private context lives in
`CLAUDE.local.md` or `BRIEF.md`, and both are gitignored.

## Architecture (hard constraints)

- **Zero running cost.** Use free tiers that allow commercial use only. If a feature
  needs a paid plan, stop and ask.
- **Fully static site.** Next.js runs with `output: "export"` and is served by Cloudflare
  static assets. There are no API routes, route handlers, middleware/proxy, server
  actions or `cookies()`. Dynamic routes need `generateStaticParams`.
- **Supabase is the whole back end,** reached from the browser with the anon key only.
  The service-role key never appears in site code.
  - RLS is on every table.
  - Admin writes are allowed for the admin role only.
  - Orders are created only by the `place_order` SECURITY DEFINER function, which
    re-prices from the database and checks and reserves stock. Clients never send prices.
  - Customers read orders only by order number + phone, through a SQL function.
- **Security never relies on hidden code.** Assume every client file is public and
  editable by an attacker.
- **Catalogue pages are pre-built at deploy time.** Price and stock always load live on
  the client.
- **Payments are UPI only.** Show a QR code or UPI-app link, the customer submits the
  UTR (and optionally a screenshot), and an admin verifies it.
  - Order statuses: awaiting payment → payment submitted → paid → packed → shipped →
    delivered, plus cancelled.
  - Stock is reserved when the order is placed. Unpaid orders auto-cancel after the
    timeout in Settings, and their stock is released.
- **Money is integer paise.** Format only for display (`lib/money.ts`).
- **Imported product data is used as-is.** Never infer player, number, season, kit type,
  country or fit. Empty fields stay empty for admins to fill in.
- **Contact details, fees, the UPI ID and policy text are not hard-coded.** They come
  from admin Settings, and the storefront hides empty fields.
- **Abuse limits:**
  - Checkout: cap unpaid orders per phone and per IP, cap quantity per item, and use
    Cloudflare Turnstile.
  - Order numbers are random, and tracking lookups are rate-limited.
  - Admin login goes through an Edge Function (5 attempts per 15 min per IP + username),
    with optional TOTP.
  - Payment screenshots go in a private bucket: images only, ≤ 5 MB, and only for
    orders awaiting payment.
- **Edge Functions** (Deno, in `supabase/functions/`) handle Gmail SMTP on port 465
  through `email_queue`, admin login, Turnstile checks, and the admin publish trigger.

## Commands

`npm run dev` · `typecheck` · `lint` · `test` · `test:e2e` · `preview` · `db:generate` · `seed -- --target staging|live` · `rls:check` · `import:*`

## Data and schema

- **Schema:** `lib/db/schema.ts` (Drizzle), with RLS policies defined alongside the
  tables. Hand-written SQL (functions, triggers, grants, storage) lives in custom
  migrations in `drizzle/`.
- **Testing RLS:** every RLS or policy change needs a test in `tests/db/rls.test.ts`,
  which runs the real migrations on PGlite.
- **Image compression:** `lib/images/compress.ts` is shared by the admin upload and the
  import script. It outputs WebP, at most 1600px on the long edge, aiming for < 250 KB.
- **Colour maths:** `lib/color.ts` handles OKLCH and WCAG contrast.
- **v1 import outputs:** `scripts/import/`.
- **Design tokens:** `styles/tokens.css` is generated from `tokens.proposal.json` by
  `npm run tokens`. Never edit the CSS by hand.
- **Theming:** dark is the default. Light applies under `[data-theme="light"]`.
- **Components:** primitives are in `components/ui/`, store pieces in
  `components/store/`.
- **Design review:** happens at `/preview` (home) and `/preview/product/*`. Their sample
  content lives only in `lib/preview/sample.ts` and is labelled as sample.
- **`/styleguide`:** `app/styleguide/page.dev.tsx` exists in `next dev` only.
- **Product links:** use plain `<a data-vt>`, so cross-document view transitions and
  speculation rules apply.
- **Quiet luxury:** no countdowns, urgency banners or strike-through prices. Low stock
  is shown as calm text only.
- **Images (Phase 2):** product images and videos are copied from Supabase Storage into
  the static build at publish time and served by Cloudflare, so traffic never uses
  Supabase egress.
- **Catalogue data:** comes from `lib/catalog/source.ts`. It reads the v1 import until
  Phase 2 switches it to Supabase.

## Conventions

- Validate every form and RPC input with Zod on the client. Postgres re-validates.
- Use one branch and one PR per phase, with small commits.
- After UI work, take screenshots at 390px and 1440px.
