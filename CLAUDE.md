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
- **No customer accounts.** Guest checkout only; orders are tracked by order number +
  phone. No reviews. The wishlist lives in localStorage (`lib/stores/wishlist.ts`).
  Only admins sign in.
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
- **Edge Functions** (Deno, in `supabase/functions/`, settings in `supabase/config.toml`):
  `place-order` (Turnstile check, then `place_order()` with the service role),
  `send-email` (Gmail SMTP on port 465, drains `email_queue`), `admin-login` (rate limit,
  username → random sign-in email, then password sign-in) and `publish` (admin-only,
  dispatches `deploy.yml`). They are excluded from tsc and ESLint.
- **Public sign-ups stay off** (`enable_signup = false` in `supabase/config.toml`). Only
  the 3 admins have accounts.
- **Admin** (`app/admin/`, `components/admin/`, `lib/admin/`): static client pages using
  the admin's own session. `is_admin()` requires aal2 once an admin has TOTP on. Orders
  change only via `admin_set_order_status()`; the status flow is enforced by a trigger
  (`lib/admin/order-flow.ts` mirrors it, checked by a test). Every signed-in write is
  logged to `admin_audit_log` by trigger. Admin sign-in emails are random
  (`newAdminEmail()`), never derived from the username. SQL in
  `drizzle/0010_admin_functions.sql`, tests in `tests/db/admin.test.ts`.
- **Route groups:** store pages live in `app/(store)/` (header/footer/cart via
  `components/store/chrome.tsx`); `/admin` has its own shell. `/preview` and `/styleguide`
  are `*.dev.tsx` (dev only).

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
- **Design review:** happens at `/preview` (home) and `/preview/product/*` in `next dev`. Their sample
  content lives only in `lib/preview/sample.ts` and is labelled as sample.
- **`/styleguide`:** `app/(store)/styleguide/page.dev.tsx` exists in `next dev` only.
- **Product links:** use plain `<a data-vt>`, so cross-document view transitions and
  speculation rules apply.
- **Quiet luxury:** no countdowns, urgency banners or strike-through prices. Low stock
  is shown as calm text only.
- **Catalogue build:** `npm run build` runs `scripts/catalog/snapshot.ts` first. With
  `NEXT_PUBLIC_SUPABASE_*` set it reads published rows with the anon key, copies images
  and videos from Storage into `public/media/` (served by Cloudflare, no Supabase egress)
  and writes `.catalog/snapshot.json`; without them, pages build from the v1 import.
  It also writes `public/_redirects` (v1 `/product/<id>` → new URL) and `_headers`.
- **Live data:** price and stock load in the browser (`lib/catalog/live.ts`); static
  HTML shows build-time values until then.
- **Shop filters** (`lib/catalog/filters.ts`) are URL-synced; a facet shows only when it
  has 2+ values, so empty admin fields never produce filters.
- **Checkout** (`lib/checkout/`): `rules.ts` mirrors the SQL (phone, shipping, zones,
  line issues), `api.ts` wraps the Edge Function and RPCs and maps error codes to copy,
  `form.ts` is the Zod schema. SQL lives in `drizzle/0008_checkout_functions.sql`
  (`place_order`, `track_order`, `submit_payment`, status trigger, auto-cancel,
  `claim_emails`, `admin_set_stock`, storage policies). `tests/db/checkout.test.ts`
  covers it on PGlite.
- **Stock mode:** `products.track_stock` (default off). Off → stock is ignored (`null` in
  the catalogue). On → enforced, unset counts as 0 (`effectiveStock()` in `from-db.ts`).
- **Pay page:** `/order/_/pay` is one static file; `public/_redirects` rewrites
  `/order/<number>/pay` to it and the page reads the number from the URL. Link to it with
  a plain `<a>` or `window.location`, not the Next router.
- **Settings** (`lib/settings.ts`) load live; empty fields hide their UI. The WhatsApp
  number row default is the store's published number.
- **E2E** builds with `KITTORA_CATALOG=import` and a fake Supabase URL that
  `tests/e2e/mock-supabase.ts` answers. `SHOTS=1 npm run test:e2e` saves 390px checkout
  screenshots, and the flow asserts the 16px gutter.
- **SEO:** metadata per page, Product + BreadcrumbList JSON-LD (`lib/seo.ts`), sitemap,
  robots, default OG image; product/club pages share the jersey photo.

## Conventions

- Validate every form and RPC input with Zod on the client. Postgres re-validates.
- Use one branch and one PR per phase, with small commits.
- After UI work, take screenshots at 390px and 1440px.
