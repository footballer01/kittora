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
- **Edge Functions** (Deno, in `supabase/functions/`) handle Gmail SMTP on port 465
  through `email_queue`, and the admin publish trigger.

## Commands

`npm run dev` · `typecheck` · `lint` · `test` · `test:e2e` · `preview` · `db:generate`

## Conventions

- Validate every form and RPC input with Zod on the client. Postgres re-validates.
- Use one branch and one PR per phase, with small commits.
- After UI work, take screenshots at 390px and 1440px.
