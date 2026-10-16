import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { FLOW } from "@/lib/admin/order-flow";
import { as, freshDatabase } from "./supabase-stub";

// Admin panel SQL (drizzle/0010_admin_functions.sql) and the safety-review
// regressions, run against the real migrations.
let db: PGlite;
let adminId: string;
let mfaAdminId: string;
let strangerId: string;
let trackedId: string;

type Order = { number: string; status: string; expires_at: string | null; tracking_note?: string | null; events: { status: string }[] };

let n = 0;
const customer = () => ({
  name: "Asha Kulkarni",
  phone: `7${String(++n).padStart(9, "0")}`,
  email: "asha@example.com",
  address: "12 FC Road, Shivajinagar",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411005",
});
const place = (items: unknown) =>
  as(db, "service_role", null, async () => {
    const c = customer();
    const r = await db.query<{ o: Order }>(`SELECT public.place_order($1, $2, $3) AS o`, [JSON.stringify(c), JSON.stringify(items), `192.0.2.${n}`]);
    return { ...r.rows[0].o, phone: c.phone };
  });
const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const orderId = async (number: string) => (await rows<{ id: string }>(`SELECT id FROM public.orders WHERE number = $1`, [number]))[0].id;
const stock = async (size: string) => (await rows<{ stock: number }>(`SELECT stock FROM public.variants WHERE product_id = $1 AND size = $2`, [trackedId, size]))[0].stock;
const asAdmin = <T>(fn: () => Promise<T>) => as(db, "authenticated", adminId, fn);
const setStatus = (id: string, status: string, note: string | null = null) =>
  asAdmin(() => db.query(`SELECT public.admin_set_order_status($1, $2, $3)`, [id, status, note]));

beforeAll(async () => {
  db = await freshDatabase();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('k3x9q2@admin.kittora.internal'), ('m7p4z8@admin.kittora.internal'), ('someone@example.com') RETURNING id`,
  );
  [adminId, mfaAdminId, strangerId] = u.rows.map((r) => r.id);
  await db.query(`UPDATE public.profiles SET role = 'admin', username = 'Keeper' WHERE id = $1`, [adminId]);
  await db.query(`UPDATE public.profiles SET role = 'admin', username = 'Second' WHERE id = $1`, [mfaAdminId]);
  await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')`, [mfaAdminId]);
  const p = await db.query<{ id: string }>(
    `INSERT INTO public.products (slug, name, price_paise, track_stock, published) VALUES ('tracked', 'Tracked Jersey', 150000, true, true) RETURNING id`,
  );
  trackedId = p.rows[0].id;
  await db.query(`INSERT INTO public.variants (product_id, size, stock) VALUES ($1, 'M', 5), ($1, 'L', 5)`, [trackedId]);
}, 60_000);

describe("two-factor", () => {
  it("an admin with TOTP turned on is admin only after the second factor (aal2)", async () => {
    const check = (aal: "aal1" | "aal2") =>
      as(db, "authenticated", mfaAdminId, async () => (await rows<{ a: boolean }>(`SELECT public.is_admin() AS a`))[0].a, undefined, aal);
    expect(await check("aal1")).toBe(false);
    expect(await check("aal2")).toBe(true);
    // Without a factor, a password session is enough.
    expect(await asAdmin(async () => (await rows<{ a: boolean }>(`SELECT public.is_admin() AS a`))[0].a)).toBe(true);
  });

  it("an aal1 session of a TOTP admin can't read orders or write products", async () => {
    await as(db, "authenticated", mfaAdminId, async () => {
      expect(await rows(`SELECT * FROM public.orders`)).toHaveLength(0);
      expect((await db.query(`UPDATE public.products SET price_paise = 1`)).affectedRows).toBe(0);
    });
  });
});

describe("audit log", () => {
  it("records every admin write with what changed, by trigger", async () => {
    await asAdmin(async () => {
      await db.query(`UPDATE public.products SET season = '2024/25' WHERE id = $1`, [trackedId]);
      await db.query(`UPDATE public.settings SET payee_name = 'KITTORA'`);
      await db.query(`INSERT INTO public.delivery_zones (name, pincode_prefix, min_days, max_days) VALUES ('Pune', '411', 1, 2)`);
      await db.query(`DELETE FROM public.delivery_zones WHERE pincode_prefix = '411'`);
    });
    const log = await rows<{ actor_id: string; action: string; entity: string; details: Record<string, unknown> }>(
      `SELECT actor_id, action, entity, details FROM public.admin_audit_log ORDER BY created_at, id`,
    );
    expect(log.map((l) => `${l.action} ${l.entity}`)).toEqual(["update products", "update settings", "insert delivery_zones", "delete delivery_zones"]);
    expect(log.every((l) => l.actor_id === adminId)).toBe(true);
    expect(log[0].details).toEqual({ season: "2024/25" });
    expect(log[3].details).toEqual({ name: "Pune", pincode_prefix: "411" });
  });

  it("is readable by admins only and can't be edited or deleted by anyone signed in", async () => {
    await asAdmin(async () => {
      expect((await rows(`SELECT * FROM public.admin_audit_log`)).length).toBeGreaterThan(0);
      await expect(db.query(`DELETE FROM public.admin_audit_log`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`UPDATE public.admin_audit_log SET action = 'x'`)).rejects.toThrow(/permission denied/);
    });
    await as(db, "authenticated", strangerId, async () => {
      expect(await rows(`SELECT * FROM public.admin_audit_log`)).toHaveLength(0);
    });
    await as(db, "anon", null, async () => {
      await expect(db.query(`SELECT * FROM public.admin_audit_log`)).rejects.toThrow(/permission denied/);
    });
  });

  it("does not log checkout (no signed-in user)", async () => {
    const before = (await rows(`SELECT 1 FROM public.admin_audit_log`)).length;
    await place([{ slug: "tracked", size: "L", qty: 1 }]);
    expect((await rows(`SELECT 1 FROM public.admin_audit_log`)).length).toBe(before);
  });
});

describe("order status (admin)", () => {
  it("moves through the flow, stores the tracking note and shows it to the customer once shipped", async () => {
    const o = await place([{ slug: "tracked", size: "M", qty: 1 }]);
    const id = await orderId(o.number);
    for (const s of ["paid", "packed"]) await setStatus(id, s);
    await setStatus(id, "shipped", "Delhivery 1234567890");
    const t = await as(db, "anon", null, async () => (await rows<{ r: Order }>(`SELECT public.track_order($1, $2) AS r`, [o.number, o.phone]))[0].r);
    expect(t.tracking_note).toBe("Delhivery 1234567890");
    expect(t.events.map((e) => e.status)).toEqual(["awaiting_payment", "paid", "packed", "shipped"]);
    await setStatus(id, "delivered");
    const kinds = await rows<{ kind: string }>(`SELECT kind FROM public.email_queue WHERE order_id = $1 ORDER BY kind`, [id]);
    expect(kinds.map((k) => k.kind).sort()).toEqual(["delivered", "order_placed", "packed", "payment_confirmed", "shipped"]);
  });

  it("cancelling releases reserved stock and emails the customer", async () => {
    const before = await stock("M");
    const o = await place([{ slug: "tracked", size: "M", qty: 2 }]);
    expect(await stock("M")).toBe(before - 2);
    const id = await orderId(o.number);
    await setStatus(id, "cancelled");
    expect(await stock("M")).toBe(before);
    expect(await rows(`SELECT kind FROM public.email_queue WHERE order_id = $1 AND kind = 'cancelled'`, [id])).toHaveLength(1);
  });

  it("is refused for non-admins and for TOTP admins without the second factor", async () => {
    const o = await place([{ slug: "tracked", size: "L", qty: 1 }]);
    const id = await orderId(o.number);
    await as(db, "authenticated", strangerId, async () => {
      await expect(db.query(`SELECT public.admin_set_order_status($1, 'paid')`, [id])).rejects.toThrow(/forbidden/);
    });
    await as(db, "authenticated", mfaAdminId, async () => {
      await expect(db.query(`SELECT public.admin_set_order_status($1, 'paid')`, [id])).rejects.toThrow(/forbidden/);
    });
  });
});

// Safety review: each test here failed before its fix in 0010.
describe("safety review regressions", () => {
  it("admins (or a stolen admin session) can't rewrite an order's total, items or payment fields", async () => {
    const o = await place([{ slug: "tracked", size: "L", qty: 1 }]);
    await asAdmin(async () => {
      await expect(db.query(`UPDATE public.orders SET total_paise = 1, subtotal_paise = 1 WHERE number = $1`, [o.number])).rejects.toThrow(/permission denied/);
      await expect(db.query(`UPDATE public.orders SET utr = 'FAKE123' WHERE number = $1`, [o.number])).rejects.toThrow(/permission denied/);
    });
    expect(await rows(`SELECT total_paise FROM public.orders WHERE number = $1`, [o.number])).toEqual([{ total_paise: 150000 }]);
  });

  it("a cancelled order can't be reopened (its stock was already released: overselling)", async () => {
    const o = await place([{ slug: "tracked", size: "M", qty: 1 }]);
    const id = await orderId(o.number);
    await setStatus(id, "cancelled");
    const after = await stock("M");
    await expect(setStatus(id, "paid")).rejects.toThrow(/invalid_transition/);
    // Not even the service role or the database owner can skip the flow.
    await expect(db.query(`UPDATE public.orders SET status = 'awaiting_payment' WHERE id = $1`, [id])).rejects.toThrow(/invalid_transition/);
    expect(await stock("M")).toBe(after);
  });

  it("a shipped or delivered order can't be cancelled (that would put sold stock back)", async () => {
    const o = await place([{ slug: "tracked", size: "M", qty: 1 }]);
    const id = await orderId(o.number);
    for (const s of ["paid", "shipped"]) await setStatus(id, s);
    const after = await stock("M");
    await expect(setStatus(id, "cancelled")).rejects.toThrow(/invalid_transition/);
    await setStatus(id, "delivered");
    await expect(setStatus(id, "cancelled")).rejects.toThrow(/invalid_transition/);
    expect(await stock("M")).toBe(after);
  });

  it("with no unpaid-order timeout set (the default), an order holding stock still expires and releases it", async () => {
    await db.exec(`UPDATE public.settings SET unpaid_timeout_minutes = 0`);
    const before = await stock("L");
    const o = await place([{ slug: "tracked", size: "L", qty: 1 }]);
    expect(o.expires_at).not.toBeNull();
    expect(new Date(o.expires_at!).getTime() - Date.now()).toBeGreaterThan(47 * 3600_000);
    await db.query(`UPDATE public.orders SET expires_at = now() - interval '1 second' WHERE number = $1`, [o.number]);
    await as(db, "service_role", null, () => db.query(`SELECT public.cancel_expired_orders()`));
    expect(await stock("L")).toBe(before);
  });
});

describe("admin login (service role, via the admin-login Edge Function)", () => {
  const begin = (username: string, ip: string) =>
    as(db, "service_role", null, async () => (await rows<{ r: { allowed: boolean; email?: string | null } }>(`SELECT public.admin_login_begin($1, $2) AS r`, [username, ip]))[0].r);

  it("returns the sign-in email for admin usernames only (any casing)", async () => {
    expect(await begin("keeper", "10.0.0.1")).toEqual({ allowed: true, email: "k3x9q2@admin.kittora.internal" });
    expect(await begin("nobody", "10.0.0.1")).toEqual({ allowed: true, email: null });
  });

  it("allows 5 attempts per 15 minutes per IP + username, then blocks and logs it", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await begin("Keeper", "10.0.0.2")).allowed);
    expect(results).toEqual([true, true, true, true, true, false]);
    // Another IP is not affected (an attacker can't lock the admin out).
    expect((await begin("Keeper", "10.0.0.3")).allowed).toBe(true);
    expect(await rows(`SELECT 1 FROM public.admin_audit_log WHERE action = 'login_blocked'`)).toHaveLength(1);
  });

  it("caps one IP at 20 attempts across usernames", async () => {
    const allowed = [];
    for (let i = 0; i < 21; i++) allowed.push((await begin(`guess${i}`, "10.0.0.4")).allowed);
    expect(allowed.filter(Boolean)).toHaveLength(20);
  });

  it("can't be called from the browser", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`SELECT public.admin_login_begin('keeper', '1.1.1.1')`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`SELECT public.admin_log(NULL, 'x')`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe("admin helpers", () => {
  it("dashboard returns today's orders, revenue, payments to verify, low stock, storage and email queue", async () => {
    await db.query(`INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('product-images', 'a.webp', '{"size": 2048}')`);
    await db.query(`UPDATE public.variants SET stock = 1 WHERE product_id = $1 AND size = 'L'`, [trackedId]);
    const d = await asAdmin(async () => (await rows<{ d: Record<string, unknown> }>(`SELECT public.admin_dashboard() AS d`))[0].d);
    expect(d.orders_today as number).toBeGreaterThan(0);
    expect(d.revenue_week_paise as number).toBeGreaterThan(0);
    expect(d.storage_bytes).toBe(2048);
    expect(d.storage_limit_bytes).toBe(1073741824);
    expect(d.low_stock).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Tracked Jersey", size: "L", stock: 1 })]));
    expect(Object.keys(d.email as object)).toContain("pending");
  });

  it("reorders product images in one call, and refuses a partial list", async () => {
    const imgs = await db.query<{ id: string }>(
      `INSERT INTO public.product_images (product_id, storage_path, position) VALUES ($1, 'a', 0), ($1, 'b', 1), ($1, 'c', 2) RETURNING id`,
      [trackedId],
    );
    const [a, b, c] = imgs.rows.map((r) => r.id);
    await asAdmin(() => db.query(`SELECT public.admin_reorder_images($1, $2)`, [trackedId, [c, a, b]]));
    expect(await rows(`SELECT storage_path FROM public.product_images WHERE product_id = $1 ORDER BY position`, [trackedId])).toEqual([
      { storage_path: "c" },
      { storage_path: "a" },
      { storage_path: "b" },
    ]);
    await expect(asAdmin(() => db.query(`SELECT public.admin_reorder_images($1, $2)`, [trackedId, [a, b]]))).rejects.toThrow(/invalid_order/);
    await as(db, "authenticated", strangerId, async () => {
      await expect(db.query(`SELECT public.admin_reorder_images($1, $2)`, [trackedId, [a, b, c]])).rejects.toThrow(/forbidden/);
    });
  });
});

describe("order flow", () => {
  it("the admin buttons (lib/admin/order-flow.ts) match what Postgres allows", async () => {
    const statuses = Object.keys(FLOW);
    const allowed = await rows<{ f: string; t: string }>(
      `SELECT f, t FROM unnest(string_to_array($1, ',')::public.order_status[]) f, unnest(string_to_array($1, ',')::public.order_status[]) t WHERE public.order_transition_ok(f, t)`,
      [statuses.join(",")],
    );
    const fromSql = Object.fromEntries(statuses.map((s) => [s, allowed.filter((a) => a.f === s).map((a) => a.t).sort()]));
    expect(fromSql).toEqual(Object.fromEntries(Object.entries(FLOW).map(([k, v]) => [k, [...v].sort()])));
  });
});
