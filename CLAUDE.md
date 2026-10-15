@AGENTS.md

# Kittora — working notes for coding agents

This repository is public. Never write secrets, account names, admin usernames,
customer data or private planning notes into tracked files. Private context lives in
`CLAUDE.local.md` or `BRIEF.md`, and both are gitignored.

## Hard constraints

- **Zero running cost.** Use free tiers that allow commercial use only. If a feature
  needs a paid plan, stop and ask.
- **Cloudflare Workers free plan.** The compressed Worker must stay ≤ 2.8 MiB
  (`npm run build:worker && npm run size:check`). Lazy-load admin code, avoid heavy
  dependencies, and keep request CPU low by prerendering where possible.
- **No R2 and no Cloudflare Images.** Images are compressed when uploaded and served
  from Supabase Storage.
- **Cache Components are off.** They hang in the Workers runtime.
- **Security never relies on hidden code.** Use RLS on every table, role checks in every
  admin server action, Razorpay signature verification, and server-side re-pricing.
- **Money is integer paise.** Format only for display (`lib/money.ts`).
- **Imported product data is used as-is.** Never infer player, number, season, kit type,
  country or fit. Empty fields stay empty for admins to fill in.
- **Contact details, fees and policy text are not hard-coded.** They come from admin
  Settings, and the storefront hides empty fields.

## Commands

`npm run dev` · `typecheck` · `lint` · `test` · `test:e2e` · `preview` · `db:generate`

## Conventions

- Validate every form and API input with Zod.
- Server Components are the default. Add `"use client"` only where needed.
- Use one branch and one PR per phase, with small commits.
- After UI work, take screenshots at 390px and 1440px.
