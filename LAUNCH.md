# Launch guide

How to take KITTORA from "built and tested" to "taking real orders", in order.
Everything here is free. Steps marked **You** need your accounts or your phone.
Steps marked **Claude** are done by Claude Code in this repo: copy the message in the
grey box and send it.

Never paste keys or passwords into a chat, a GitHub issue or any file other than
`.env.local` (which is never committed).

---

## 1. Create the two Supabase projects — **You** (about 15 minutes)

1. Go to [supabase.com](https://supabase.com), sign up (free), and click **New project**.
   - Name: `kittora-staging`. Plan: **Free**. Region: **South Asia (Mumbai)**.
   - Make up a database password and save it in your password manager.
2. Repeat for a second project called `kittora-live`.
3. For **each** project, collect four values:
   - **Project URL** and **anon / publishable key**: Project Settings → **API** (or the
     **Connect** button at the top).
   - **service_role / secret key**: Project Settings → **API Keys**. Treat it like a
     password: it bypasses all security.
   - **Connection string**: **Connect** → **Session pooler** (port 5432). Replace
     `[YOUR-PASSWORD]` with that project's database password.
4. In the `kittora` folder, copy `.env.example` to `.env.local` and fill in:

   | Variable | Value |
   | --- | --- |
   | `STAGING_SUPABASE_URL` | staging Project URL |
   | `STAGING_SUPABASE_ANON_KEY` | staging anon key |
   | `STAGING_SUPABASE_SERVICE_ROLE_KEY` | staging service_role key |
   | `STAGING_DATABASE_URL_DIRECT` | staging Session pooler string |
   | `LIVE_SUPABASE_URL` … `LIVE_DATABASE_URL_DIRECT` | the same four, from live |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **staging** URL and anon key again |
   | `ADMIN_1_USERNAME` / `ADMIN_1_PASSWORD` (and 2, 3) | each admin's username and a password of 12+ characters |

5. Install the Supabase command-line tool's login once, so Claude can deploy for you:
   ```bash
   npx supabase login
   ```
   A browser window opens; approve it.

## 2. Set up staging and place a test order — **Claude**

> Keys are in .env.local and I've run `supabase login`. Set up **staging**: run the
> migrations and the seed, push supabase/config.toml, deploy all four Edge Functions,
> run the RLS checks, then place and pay a full test order on staging, verify it in
> admin, and cancel it. Tell me what passed.

Claude will:
- run the database migrations and `npm run seed -- --target staging` (products, photos
  and the 3 admin accounts; each admin gets a random sign-in email, so only the
  username + password you chose matter);
- run `supabase config push` (public sign-ups off, two-factor codes on);
- deploy `place-order`, `send-email`, `admin-login` and `publish`;
- run the security checks against staging;
- start the site locally against staging, place an order, submit a test UTR, sign in to
  `/admin`, mark it paid, and cancel it (checking the stock comes back).

## 3. Turn off public sign-ups — **You** (2 minutes, both projects)

Claude's `config push` already does this, but check it yourself in each project:
Supabase dashboard → **Authentication** → **Sign In / Providers** → **Allow new users to
sign up** must be **off**. Only the 3 admins may ever have accounts. (The seed prints a
big warning if it's still on.)

## 4. Cloudflare, Turnstile and GitHub — **You** (about 20 minutes)

1. **Cloudflare account**: sign up free at [dash.cloudflare.com](https://dash.cloudflare.com).
   Open **Workers & Pages** and claim a free `workers.dev` subdomain.
2. **Cloudflare API token**: My Profile → **API Tokens** → **Create Token** → template
   **Edit Cloudflare Workers**. Copy the token. Also copy your **Account ID** (on the
   Workers & Pages overview, right-hand side).
3. **Turnstile** (the "are you human" check at checkout): Cloudflare dashboard →
   **Turnstile** → **Add widget**. Hostname: your `kittora.<subdomain>.workers.dev`
   address (add `localhost` too). Mode: **Managed**. Copy the **site key** and the
   **secret key**.
4. **GitHub deploy token** (for the admin **Publish changes** button): GitHub →
   Settings → Developer settings → **Fine-grained tokens** → Generate. Repository
   access: *Only select repositories* → `kittora`. Permissions: **Actions: Read and
   write**, nothing else. Expiry: 1 year (set a reminder to renew).
5. In the GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
   - **Secrets** tab: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and
     `STAGING_DATABASE_URL` / `LIVE_DATABASE_URL` (the two Session pooler strings from
     step 1, used by the daily keep-awake job).
   - **Variables** tab: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (the **live** values), `NEXT_PUBLIC_SITE_URL` (your workers.dev address),
     `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the Turnstile site key).
   - Don't set `DEPLOY_ENABLED` yet.
6. Put the Turnstile secret key and the GitHub token into `.env.local` temporarily, on
   these lines, so Claude can store them in Supabase (delete them afterwards):
   ```
   TURNSTILE_SECRET_KEY=...
   GITHUB_DEPLOY_TOKEN=...
   ```

## 5. Set up live and deploy — **Claude**, then **You**

> Staging passed. Set up **live** the same way (migrations, seed, config push, the four
> Edge Functions, RLS checks — no test order yet). Store TURNSTILE_SECRET_KEY on both
> projects and GITHUB_DEPLOY_TOKEN + GITHUB_REPO on live, from .env.local. Then tell me
> to switch on deploys.

Then **You**: GitHub repo → Settings → Secrets and variables → Actions → **Variables** →
add `DEPLOY_ENABLED` = `true`. Open **Actions → Deploy → Run workflow**. After about 3
minutes the shop is live at your workers.dev address. Delete the two temporary lines
from `.env.local`.

## 6. Fill in the admin — **You** (on your phone is fine)

Open `<your site>/admin` and sign in with your username and password.

1. **Account** → **Set up two-factor** (each admin, on their own phone). Recommended.
2. **Settings**:
   - Payment: your business **UPI ID**, **payee name**, **WhatsApp number**, and
     **Cancel unpaid orders after** (for example 1440 minutes = 1 day).
   - Shipping: fee and free-shipping threshold (leave empty for free shipping).
   - Contact: email, phone, address. Social links (must start with `https://`).
   - Policy pages: Shipping, Returns, Terms and Privacy text.
   - Press **Save settings**. These apply instantly.
3. **Delivery**: add zones (for example `Pune`, prefix `411`, 1–2 days), or import a CSV.
4. **Products** → **Needs details**: open each product and fill in the highlighted
   fields (season, kit type, fit, description, back photo…). Turn on **Track stock** and
   enter counts only for shirts where you know the exact stock.
5. **Dashboard** → **Publish changes** so the shop pages pick up the product edits.

## 7. One real test order — **You** (10 minutes)

1. In admin → **Products** → **Add product**: name "Test item", price `1`, one size,
   **Show in shop** on. Save, add any photo, then **Publish changes** and wait ~3 minutes.
2. On your phone, open the shop, add "Test item" to the cart and check out with your own
   details.
3. On the payment page, tap **Pay with UPI app** (or scan the QR from another phone) and
   pay ₹1. Check that the amount and payee name are right. Try a second UPI app too.
4. Enter the UTR from your UPI app and submit.
5. In admin → **Orders** → **Payment submitted**: compare the UTR, tap **Mark paid**, open
   **Packing slip**, then **Cancel order**.
6. Delete the "Test item" product and **Publish changes** again.

You're live. 🎉

## Optional, later

- **Order emails (Gmail)** — **You** create an App Password (README → "Order email"),
  then tell Claude:
  > Set GMAIL_USER, GMAIL_APP_PASSWORD and SITE_URL on both Supabase projects and
  > create the email_queue webhook.

  Until then, orders work normally and emails are marked "skipped" on the dashboard.
- **Custom domain** — buy a domain, add it in Cloudflare (Workers & Pages → kittora →
  Settings → Domains), then tell Claude:
  > Switch the site to <domain>: update NEXT_PUBLIC_SITE_URL, SITE_URL and the Turnstile
  > hostnames checklist.
