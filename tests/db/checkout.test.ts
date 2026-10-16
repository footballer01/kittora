import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { as, freshDatabase } from "./supabase-stub";

// place_order, track_order, submit_payment, auto-cancel and the email queue,
// run against the real migrations.
let db: PGlite;
let adminId: string;
let trackedId: string;

type Order = {
  number: string;
  status: string;
  total_paise: number;
  subtotal_paise: number;
  shipping_paise: number;
  upload_key: string | null;
  items: { slug: string; size: string; qty: number; unit_price_paise: number }[];
  events: { status: string }[];
  error?: string;
};

let phoneCounter = 0;
const customer = (extra: Record<string, string> = {}) => ({
  name: "Asha Kulkarni",
  // A fresh phone per order unless a test sets one (unpaid orders are capped per phone).
  phone: `+91 8${String(++phoneCounter).padStart(9, "0")}`,
  email: "asha@example.com",
  address: "12 FC Road, Shivajinagar",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411005",
  ...extra,
});

let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;

async function place(items: unknown, extra: Record<string, string> = {}, ip = freshIp()): Promise<Order> {
  return as(db, "service_role", null, async () => {
    const r = await db.query<{ o: Order }>(`SELECT public.place_order($1, $2, $3) AS o`, [JSON.stringify(customer(extra)), JSON.stringify(items), ip]);
    return r.rows[0].o;
  });
}
const anon = <T>(sql: string, params: unknown[], ip = freshIp()) =>
  as(db, "anon", null, async () => (await db.query<{ r: T }>(sql, params)).rows[0].r, ip);
const stock = async (slug: string, size: string) =>
  (
    await db.query<{ stock: number | null }>(
      `SELECT v.stock FROM public.variants v JOIN public.products p ON p.id = v.product_id WHERE p.slug = $1 AND v.size = $2`,
      [slug, size],
    )
  ).rows[0].stock;

beforeAll(async () => {
  db = await freshDatabase();
  const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ('admin@admin.kittora.internal') RETURNING id`);
  adminId = u.rows[0].id;
  await db.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [adminId]);
  const p = await db.query<{ id: string }>(
    `INSERT INTO public.products (slug, name, price_paise, track_stock, published) VALUES
       ('untracked', 'Untracked Jersey', 99900, false, true),
       ('tracked', 'Tracked Jersey', 150000, true, true),
       ('hidden', 'Hidden Jersey', 1000, false, false)
     RETURNING id`,
  );
  trackedId = p.rows[1].id;
  await db.query(
    `INSERT INTO public.variants (product_id, size, stock) VALUES ($1, 'M', NULL), ($1, 'L', 0), ($2, 'M', 3), ($2, 'L', NULL), ($3, 'M', 5)`,
    p.rows.map((r) => r.id),
  );
}, 60_000);

beforeEach(async () => {
  await db.exec(`UPDATE public.settings SET shipping_fee_paise = 0, free_shipping_threshold_paise = 0, unpaid_timeout_minutes = 0`);
});

describe("place_order", () => {
  it("prices from the database, ignores client prices and returns a random order number", async () => {
    const o = await place([{ slug: "untracked", size: "M", qty: 2, price_paise: 1 }]);
    expect(o.number).toMatch(/^KT[2-9A-HJ-NP-Z]{10}$/);
    expect(o.status).toBe("awaiting_payment");
    expect(o.total_paise).toBe(199800);
    expect(o.items).toEqual([{ slug: "untracked", name: "Untracked Jersey", size: "M", qty: 2, unit_price_paise: 99900 }]);
    expect(o.events.map((e) => e.status)).toEqual(["awaiting_payment"]);
  });

  it("never reserves or checks stock when tracking is off", async () => {
    const o = await place([{ slug: "untracked", size: "L", qty: 5 }]);
    expect(o.total_paise).toBe(5 * 99900);
    expect(await stock("untracked", "L")).toBe(0);
  });

  it("reserves tracked stock, rejects overselling, and treats null stock as 0", async () => {
    await place([{ slug: "tracked", size: "M", qty: 2 }]);
    expect(await stock("tracked", "M")).toBe(1);
    await expect(place([{ slug: "tracked", size: "M", qty: 2 }])).rejects.toThrow(/out_of_stock/);
    await expect(place([{ slug: "tracked", size: "L", qty: 1 }])).rejects.toThrow(/out_of_stock/);
    expect(await stock("tracked", "M")).toBe(1);
  });

  it("merges duplicate lines and caps quantity per item", async () => {
    await expect(place([{ slug: "untracked", size: "M", qty: 3 }, { slug: "untracked", size: "M", qty: 3 }])).rejects.toThrow(/quantity_limit/);
    await expect(place([{ slug: "untracked", size: "M", qty: 0 }])).rejects.toThrow(/quantity_limit/);
  });

  it("rejects unpublished products, unknown sizes and malformed input", async () => {
    await expect(place([{ slug: "hidden", size: "M", qty: 1 }])).rejects.toThrow(/unavailable/);
    await expect(place([{ slug: "untracked", size: "XXL", qty: 1 }])).rejects.toThrow(/unavailable/);
    await expect(place([])).rejects.toThrow(/invalid_items/);
    await expect(place([{ slug: "untracked", size: "M", qty: "1; drop table" }])).rejects.toThrow(/invalid_items/);
    await expect(place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "12345" })).rejects.toThrow(/invalid_phone/);
    await expect(place([{ slug: "untracked", size: "M", qty: 1 }], { pincode: "011005" })).rejects.toThrow(/invalid_pincode/);
    await expect(place([{ slug: "untracked", size: "M", qty: 1 }], { email: "nope" })).rejects.toThrow(/invalid_email/);
  });

  it("adds the shipping fee from settings unless the free-shipping threshold is met", async () => {
    await db.exec(`UPDATE public.settings SET shipping_fee_paise = 9900, free_shipping_threshold_paise = 150000`);
    const small = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9000000001" });
    expect([small.subtotal_paise, small.shipping_paise, small.total_paise]).toEqual([99900, 9900, 109800]);
    const big = await place([{ slug: "untracked", size: "M", qty: 2 }], { phone: "9000000002" });
    expect(big.shipping_paise).toBe(0);
  });

  it("caps unpaid orders per phone and per IP", async () => {
    const line = [{ slug: "untracked", size: "M", qty: 1 }];
    await place(line, { phone: "9111111111" });
    await place(line, { phone: "9111111111" });
    await expect(place(line, { phone: "9111111111" })).rejects.toThrow(/too_many_unpaid/);
    const ip = "192.0.2.77";
    for (let i = 0; i < 4; i++) await place(line, { phone: `92222222${10 + i}` }, ip);
    await expect(place(line, { phone: "9222222299" }, ip)).rejects.toThrow(/too_many_unpaid/);
  });

  it("is not callable with the anon key", async () => {
    await expect(anon(`SELECT public.place_order('{}', '[]', '1.1.1.1') AS r`, [])).rejects.toThrow(/permission denied/);
  });
});

describe("track_order", () => {
  it("finds an order only with the matching phone, in any format", async () => {
    const o = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9333333333" });
    const found = await anon<Order>(`SELECT public.track_order($1, $2) AS r`, [o.number.toLowerCase(), "+91-93333 33333"]);
    expect(found.number).toBe(o.number);
    expect(found).not.toHaveProperty("phone");
    expect(found).not.toHaveProperty("address");
    expect(await anon(`SELECT public.track_order($1, $2) AS r`, [o.number, "9333333334"])).toBeNull();
    expect(await anon(`SELECT public.track_order($1, $2) AS r`, ["KTNOSUCHORD", "9333333333"])).toBeNull();
  });

  it("rate-limits lookups per IP", async () => {
    const ip = "192.0.2.200";
    for (let i = 0; i < 20; i++) await anon(`SELECT public.track_order($1, $2) AS r`, [`KTGUESS${i}`, "9000000000"], ip);
    await expect(anon(`SELECT public.track_order('KTX', '9000000000') AS r`, [], ip)).rejects.toThrow(/rate_limited/);
  });

  it("rate-limits guesses against one order number from many IPs", async () => {
    const o = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9444444444" });
    for (let i = 0; i < 10; i++) await anon(`SELECT public.track_order($1, $2) AS r`, [o.number, `94444444${10 + i}`]);
    await expect(anon(`SELECT public.track_order($1, '9444444444') AS r`, [o.number])).rejects.toThrow(/rate_limited/);
  });
});

describe("payment", () => {
  it("accepts a UTR and screenshot for an unpaid order, once", async () => {
    const o = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9555555555" });
    const path = `${o.upload_key}/proof.jpg`;
    await as(db, "anon", null, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-proofs', $1)`, [path]));
    const paid = await anon<Order>(`SELECT public.submit_payment($1, $2, $3, $4) AS r`, [o.number, "9555555555", "4123 5678 9012", path]);
    expect(paid.status).toBe("payment_submitted");
    expect(paid.upload_key).toBeNull();
    expect(await anon(`SELECT public.submit_payment($1, $2, '412356789012') AS r`, [o.number, "9555555555"])).toEqual({ error: "not_awaiting_payment" });
    // The order's upload folder closes once payment is submitted.
    await expect(
      as(db, "anon", null, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-proofs', $1)`, [`${o.upload_key}/2.jpg`])),
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects wrong phones, bad UTRs and other orders' screenshots", async () => {
    const a = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9666666666" });
    const b = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9666666667" });
    expect(await anon(`SELECT public.submit_payment($1, '9666666660', '412356789012') AS r`, [a.number])).toEqual({ error: "not_found" });
    expect(await anon(`SELECT public.submit_payment($1, '9666666666', '12') AS r`, [a.number])).toEqual({ error: "invalid_utr" });
    const other = `${b.upload_key}/x.jpg`;
    await as(db, "anon", null, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-proofs', $1)`, [other]));
    expect(await anon(`SELECT public.submit_payment($1, '9666666666', '412356789012', $2) AS r`, [a.number, other])).toEqual({ error: "invalid_proof" });
  });

  it("blocks uploads outside a real order folder and caps files per order", async () => {
    const upload = (name: string) => as(db, "anon", null, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-proofs', $1)`, [name]));
    await expect(upload(`${crypto.randomUUID()}/x.jpg`)).rejects.toThrow(/row-level security/);
    await expect(upload(`x.jpg`)).rejects.toThrow(/row-level security/);
    const o = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9777777777" });
    for (const n of [1, 2, 3]) await upload(`${o.upload_key}/${n}.jpg`);
    await expect(upload(`${o.upload_key}/4.jpg`)).rejects.toThrow(/row-level security/);
    await as(db, "anon", null, async () => {
      expect((await db.query(`SELECT * FROM storage.objects WHERE bucket_id = 'payment-proofs'`)).rows).toHaveLength(0);
    });
  });
});

describe("auto-cancel and status changes", () => {
  it("cancels unpaid orders after the timeout and releases tracked stock", async () => {
    await db.exec(`UPDATE public.variants SET stock = 3 WHERE product_id = '${trackedId}' AND size = 'M'`);
    await db.exec(`UPDATE public.settings SET unpaid_timeout_minutes = 30`);
    const o = await place([{ slug: "tracked", size: "M", qty: 2 }], { phone: "9888888888" });
    expect(await stock("tracked", "M")).toBe(1);
    expect(await as(db, "service_role", null, async () => (await db.query(`SELECT public.cancel_expired_orders() AS n`)).rows)).toEqual([{ n: 0 }]);
    await db.query(`UPDATE public.orders SET expires_at = now() - interval '1 minute' WHERE number = $1`, [o.number]);
    await as(db, "service_role", null, () => db.query(`SELECT public.cancel_expired_orders()`));
    expect(await stock("tracked", "M")).toBe(3);
    // Releasing happens once, even if the status is touched again.
    await db.query(`UPDATE public.orders SET status = 'cancelled' WHERE number = $1`, [o.number]);
    expect(await stock("tracked", "M")).toBe(3);
    const t = await anon<Order>(`SELECT public.track_order($1, '9888888888') AS r`, [o.number]);
    expect(t.events.map((e) => e.status)).toEqual(["awaiting_payment", "cancelled"]);
  });

  it("queues order placed, payment confirmed and shipped emails (only with an email)", async () => {
    const o = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9999900001" });
    const noEmail = await place([{ slug: "untracked", size: "M", qty: 1 }], { phone: "9999900002", email: "" });
    await as(db, "authenticated", adminId, async () => {
      for (const s of ["paid", "packed", "shipped"]) {
        await db.query(`UPDATE public.orders SET status = $1 WHERE number = ANY($2)`, [s, [o.number, noEmail.number]]);
      }
    });
    const q = await db.query<{ kind: string; to_email: string; number: string }>(
      `SELECT q.kind, q.to_email, q.payload->>'number' AS number FROM public.email_queue q JOIN public.orders o ON o.id = q.order_id WHERE o.number = ANY($1) ORDER BY q.created_at, q.kind`,
      [[o.number, noEmail.number]],
    );
    expect(q.rows.map((r) => r.kind).sort()).toEqual(["order_placed", "payment_confirmed", "shipped"]);
    expect(new Set(q.rows.map((r) => r.number))).toEqual(new Set([o.number]));
  });

  it("hands each queued email to exactly one sender run", async () => {
    await place([{ slug: "untracked", size: "M", qty: 1 }]);
    const claim = () => as(db, "service_role", null, async () => (await db.query<{ id: string }>(`SELECT id FROM public.claim_emails(50)`)).rows);
    const first = await claim();
    expect(first.length).toBeGreaterThan(0);
    expect(await claim()).toEqual([]);
    await expect(anon(`SELECT public.claim_emails(1) AS r`, [])).rejects.toThrow(/permission denied/);
  });

  it("lets admins set stock for every size in one call", async () => {
    await as(db, "authenticated", adminId, () => db.query(`SELECT public.admin_set_stock($1, 7)`, [trackedId]));
    expect([await stock("tracked", "M"), await stock("tracked", "L")]).toEqual([7, 7]);
  });
});

describe("settings and delivery zones", () => {
  it("are publicly readable; settings start empty apart from the WhatsApp number", async () => {
    const s = await anon<Record<string, unknown>>(`SELECT to_jsonb(s) AS r FROM public.settings s`, []);
    expect(s).toMatchObject({ upi_id: null, payee_name: null, qr_image_path: null, whatsapp_number: "9764795606", shipping_fee_paise: 0 });
    expect(await as(db, "anon", null, async () => (await db.query(`SELECT * FROM public.delivery_zones`)).rows)).toEqual([]);
  });

  it("only admins change them", async () => {
    await as(db, "authenticated", adminId, async () => {
      await db.query(`UPDATE public.settings SET upi_id = 'store@upi'`);
      await db.query(`INSERT INTO public.delivery_zones (name, pincode_prefix, min_days, max_days) VALUES ('Pune', '411', 1, 2)`);
    });
    await expect(as(db, "anon", null, () => db.query(`UPDATE public.settings SET upi_id = 'evil@upi'`))).rejects.toThrow(/permission denied/);
    expect((await db.query(`SELECT upi_id FROM public.settings`)).rows).toEqual([{ upi_id: "store@upi" }]);
  });
});
