import type { Page, Route } from "@playwright/test";

// End-to-end tests build the site against this fake Supabase URL (see
// playwright.config.ts) and answer its requests here. Unrouted requests fail
// fast (nothing listens on the port), so pages fall back to build-time data.
export const MOCK_SUPABASE_URL = "http://127.0.0.1:54321";

export const NUMBER = "KT7H2Q9MXC4P";
const SLUG = "arsenal-red-and-white-saka-7-jersey";
const at = (min: number) => new Date(Date.UTC(2026, 9, 16, 6, min)).toISOString();

export const settingsRow = {
  id: true,
  upi_id: "kittora@upi",
  payee_name: null,
  qr_image_path: null,
  whatsapp_number: "9764795606",
  unpaid_timeout_minutes: 1440,
  shipping_fee_paise: 9900,
  free_shipping_threshold_paise: 250000,
  contact_email: null,
  contact_phone: null,
  contact_address: null,
  instagram_url: null,
};

export const order = (status: string, events: string[]) => ({
  number: NUMBER,
  status,
  name: "Asha Kulkarni",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411005",
  subtotal_paise: 90000,
  shipping_paise: 9900,
  total_paise: 99900,
  utr_submitted: status !== "awaiting_payment",
  created_at: at(0),
  expires_at: status === "awaiting_payment" ? new Date(Date.now() + 86_400_000).toISOString() : null,
  upload_key: status === "awaiting_payment" ? "6f1c2b9e-0d4a-4c51-9f0e-2b7d3c1a8e55" : null,
  items: [{ slug: SLUG, name: "Arsenal Red and White Saka #7 Jersey", size: "M", qty: 1, unit_price_paise: 90000 }],
  events: events.map((s, i) => ({ status: s, at: at(i * 7) })),
});

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "content-type": "application/json",
};

export type Calls = { placeOrder: unknown[]; submitPayment: unknown[] };

/** Routes the Supabase endpoints the checkout uses. `status` is what track_order reports. */
export async function mockSupabase(page: Page, opts: { status?: () => string } = {}): Promise<Calls> {
  const calls: Calls = { placeOrder: [], submitPayment: [] };
  const status = opts.status ?? (() => "awaiting_payment");
  await page.route(`${MOCK_SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    const send = (body: unknown, code = 200) => route.fulfill({ status: code, headers, body: JSON.stringify(body) });
    switch (url.pathname) {
      case "/rest/v1/settings":
        return send(settingsRow);
      case "/rest/v1/delivery_zones":
        return send([{ name: "Pune", pincode_prefix: "411", min_days: 2, max_days: 4 }]);
      case "/functions/v1/place-order":
        calls.placeOrder.push(req.postDataJSON());
        return send({ order: order("awaiting_payment", ["awaiting_payment"]) });
      case "/rest/v1/rpc/track_order": {
        const s = status();
        const steps = ["awaiting_payment", "payment_submitted", "paid", "packed", "shipped"];
        return send(order(s, steps.slice(0, steps.indexOf(s) + 1)));
      }
      case "/rest/v1/rpc/submit_payment":
        calls.submitPayment.push(req.postDataJSON());
        return send(order("payment_submitted", ["awaiting_payment", "payment_submitted"]));
      default:
        return route.abort("connectionrefused");
    }
  });
  return calls;
}
