import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { MOCK_SUPABASE_URL, settingsRow } from "./mock-supabase";

// Fake Supabase for the admin panel: sign-in through the admin-login function,
// Auth's user endpoint, the admin RPCs and the tables the pages read.
export const PASSWORD = "correct horse battery";
const USER_ID = "8d0f7a52-3c1e-4c55-9a51-0f6f3b7f2e10";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (aal = "aal1") =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, role: "authenticated", aal, exp: Math.floor(Date.now() / 1000) + 3600, session_id: "s1", email: "a-x@admin.kittora.internal" })}.c2ln`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "a-x@admin.kittora.internal", factors: [], app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };

const imported = (JSON.parse(readFileSync("scripts/import/products.json", "utf8")) as { products: { slug: string; name: string; club: string | null; pricePaise: number; audience: string[]; sizes: { label: string }[] }[] }).products;
export const products = imported.slice(0, 3).map((p, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  slug: p.slug,
  name: p.name,
  club: p.club,
  country: null,
  player: null,
  number: null,
  season: i === 0 ? "2024/25" : null,
  kit_type: null,
  fit: null,
  audience: p.audience,
  description: null,
  story: null,
  story_title: null,
  video: null,
  price_paise: p.pricePaise,
  track_stock: i === 0,
  featured: i === 0,
  featured_position: i === 0 ? 1 : null,
  published: true,
  updated_at: "2026-10-16T06:00:00Z",
  product_images: [{ id: `img-${i}`, storage_path: `products/${p.slug}/1.webp`, kind: "front", position: 0, width: 1200, height: 786, alt: p.name }],
  variants: p.sizes.map((s, j) => ({ id: `v-${i}-${j}`, size: s.label, stock: i === 0 ? (j === 1 ? 1 : 6) : null, position: j })),
}));

const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
export const orders = [
  {
    id: "o1",
    number: "KT7H2Q9MXC4P",
    name: "Asha Kulkarni",
    phone: "9876543210",
    email: "asha@example.com",
    address: "12 FC Road, Shivajinagar",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411005",
    status: "payment_submitted",
    subtotal_paise: 90000,
    shipping_paise: 9900,
    total_paise: 99900,
    utr: "412398765432",
    payment_proof_path: "6f1c2b9e-0d4a-4c51-9f0e-2b7d3c1a8e55/proof.jpg",
    tracking_note: null,
    expires_at: null,
    created_at: at(2),
    updated_at: at(1),
    order_items: [{ id: "i1", slug: products[0].slug, name: products[0].name, size: "M", qty: 1, unit_price_paise: 90000 }],
  },
  {
    id: "o2",
    number: "KTQ3W8E2R5T6",
    name: "Rohan Mehta",
    phone: "9123456780",
    email: null,
    address: "Flat 4B, Palm Grove, Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400053",
    status: "payment_submitted",
    subtotal_paise: 180000,
    shipping_paise: 0,
    total_paise: 180000,
    utr: "604512349876",
    payment_proof_path: null,
    tracking_note: null,
    expires_at: null,
    created_at: at(5),
    updated_at: at(4),
    order_items: [{ id: "i2", slug: products[1].slug, name: products[1].name, size: "L", qty: 2, unit_price_paise: 90000 }],
  },
];

const dashboard = {
  orders_today: 3,
  revenue_week_paise: 459700,
  payments_to_verify: 2,
  to_pack: 1,
  low_stock: [{ id: products[0].id, name: products[0].name, size: "M", stock: 1 }],
  storage_bytes: 9_400_000,
  storage_limit_bytes: 1073741824,
  email: { pending: 1, skipped: 6 },
};

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "content-type": "application/json",
};

export type AdminCalls = { login: unknown[]; status: unknown[]; productUpdates: unknown[] };

export async function mockAdmin(page: Page): Promise<AdminCalls> {
  const calls: AdminCalls = { login: [], status: [], productUpdates: [] };
  const image = readFileSync(`public/fixtures/products/${products[0].slug}.webp`);
  await page.route(`${MOCK_SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    const send = (body: unknown, code = 200) => route.fulfill({ status: code, headers, body: JSON.stringify(body) });
    const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const p = url.pathname;
    if (p.startsWith("/storage/v1/object/public/")) return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/webp" }, body: image });
    switch (p) {
      case "/functions/v1/admin-login": {
        const body = req.postDataJSON() as { username: string; password: string };
        calls.login.push(body.username);
        if (body.password !== PASSWORD) return send({ error: "invalid" }, 401);
        return send({ session: { access_token: jwt(), refresh_token: "r1" }, mfa: false });
      }
      case "/functions/v1/publish":
        return send({ run: { status: "completed", conclusion: "success", created_at: at(3), html_url: "https://github.com/" } });
      case "/auth/v1/user":
        return send(user);
      case "/auth/v1/logout":
        return route.fulfill({ status: 204, headers });
      case "/rest/v1/rpc/is_admin":
        return send(true);
      case "/rest/v1/rpc/admin_dashboard":
        return send(dashboard);
      case "/rest/v1/rpc/admin_set_order_status":
        calls.status.push(req.postDataJSON());
        return send({ id: "o1", status: (req.postDataJSON() as { p_status: string }).p_status, tracking_note: null });
      case "/rest/v1/admin_audit_log":
        return send([
          { id: "a1", action: "update", entity: "orders", details: { status: "paid" }, created_at: at(1), actor_id: USER_ID },
          { id: "a2", action: "update", entity: "products", details: { season: "2024/25" }, created_at: at(3), actor_id: USER_ID },
          { id: "a3", action: "login", entity: null, details: { mfa: false }, created_at: at(4), actor_id: USER_ID },
        ]);
      case "/rest/v1/products": {
        if (req.method() === "PATCH") {
          calls.productUpdates.push(req.postDataJSON());
          return route.fulfill({ status: 204, headers });
        }
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        const rows = id ? products.filter((x) => x.id === id) : products;
        return send(single ? rows[0] : rows);
      }
      case "/rest/v1/variants":
        return route.fulfill({ status: req.method() === "POST" ? 201 : 204, headers });
      case "/rest/v1/orders": {
        const status = url.searchParams.get("status")?.replace(/^eq\./, "");
        return send(orders.filter((o) => !status || o.status === status));
      }
      case "/rest/v1/settings":
        return send(single ? settingsRow : [settingsRow]);
      case "/rest/v1/delivery_zones":
        return send([{ id: "z1", name: "Pune", pincode_prefix: "411", min_days: 2, max_days: 4, cod_available: false }]);
      case "/rest/v1/edits":
        return send([]);
      default:
        return route.abort("connectionrefused");
    }
  });
  return calls;
}
