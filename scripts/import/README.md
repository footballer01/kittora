# v1 import (Phase 0.5)

Read-only scripts that capture the Base44 v1 store
(https://terrace-archive-kit.base44.app) as data for v2. They crawl politely,
one page at a time with a delay and 2 retries, and never add to cart, submit
forms or change anything on v1.

Run them in order:

| Step | Command | Writes |
| --- | --- | --- |
| 1 | `npm run import:crawl` | `products.json`, `redirects.json`, `copy.json`*, `images/originals/`*, `raw/`* |
| 2 | `npm run import:compress` | `images/webp/`* using `lib/images/compress.ts` (the admin upload's module) in headless Chromium |
| 3 | `npm run import:theme` | `theme.json`*, `screenshots/`* (5 page types at 390px and 1440px) |
| 4 | `npm run import:baseline` | `baseline.json`, `lighthouse/`* (Lighthouse mobile ×3, axe, design audit) |
| 5 | `npm run import:tokens` | `tokens.proposal.json` (proposal only, not applied) |
| 6 | `npm run import:report` | `report.html`* — open it in a browser |

\* gitignored: raw dumps, originals, screenshots and anything that contains v1's
private contact details stay on your machine.

The data rules:

- Products are recorded exactly as v1 shows them.
- Player, shirt number, season, kit type, fit and stock are left empty for admins.
- `v1Details` keeps v1's raw "Fit / Category / Club" block for reference only.

Seeding Supabase from these files is `npm run seed -- --target staging|live`
(see `scripts/seed.ts`).
