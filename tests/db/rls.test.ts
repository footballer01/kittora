import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDatabase } from "./supabase-stub";

let db: PGlite;
let adminId: string;
let customerId: string;
let publishedId: string;
let draftId: string;

beforeAll(async () => {
  db = await freshDatabase();
  const users = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('admin@admin.kittora.internal'), ('fan@example.com') RETURNING id`,
  );
  [adminId, customerId] = users.rows.map((r) => r.id);
  // Done by the seed with the service role:
  await db.query(`UPDATE public.profiles SET role = 'admin', username = 'Admin-One' WHERE id = $1`, [adminId]);
  const p = await db.query<{ id: string }>(
    `INSERT INTO public.products (slug, name, price_paise, published) VALUES ('shirt', 'Shirt', 90000, true), ('draft', 'Draft', 90000, false) RETURNING id`,
  );
  [publishedId, draftId] = p.rows.map((r) => r.id);
  await db.query(`INSERT INTO public.variants (product_id, size, stock) VALUES ($1, 'M', 3), ($2, 'M', 1)`, [publishedId, draftId]);
  await db.query(`INSERT INTO public.orders (number, name, phone, address, city, state, pincode, subtotal_paise, total_paise) VALUES ('K7Q2M9', 'A Fan', '9999999999', '1 Main Road', 'Pune', 'Maharashtra', '411001', 90000, 90000)`);
}, 60_000);

const rows = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;

describe("auth trigger", () => {
  it("creates a customer profile for every new user", async () => {
    const [profile] = await rows(`SELECT role FROM public.profiles WHERE id = $1`, [customerId]);
    expect(profile).toEqual({ role: "customer" });
  });
});

describe("anonymous visitor (anon key)", () => {
  it("can read published products and their variants", async () => {
    await as(db, "anon", null, async () => {
      expect((await rows(`SELECT slug FROM public.products`)).map((r) => (r as { slug: string }).slug)).toEqual(["shirt"]);
      expect(await rows(`SELECT size FROM public.variants`)).toHaveLength(1);
    });
  });

  it("cannot write products, variants or images", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`INSERT INTO public.products (slug, name, price_paise) VALUES ('x', 'x', 1)`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`UPDATE public.products SET price_paise = 1`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`DELETE FROM public.variants`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`INSERT INTO public.product_images (product_id, storage_path) VALUES ($1, 'x')`, [publishedId])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("cannot read orders or profiles", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`SELECT * FROM public.orders`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`SELECT * FROM public.profiles`)).rejects.toThrow(/permission denied/);
    });
  });

  it("cannot upload to the product image bucket", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'x.webp')`)).rejects.toThrow(
        /row-level security/,
      );
    });
  });

  it("is not an admin", async () => {
    await as(db, "anon", null, async () => {
      expect(await rows(`SELECT public.is_admin() AS a`)).toEqual([{ a: false }]);
    });
  });
});

// No customer accounts exist (guest checkout), but any stray signed-in
// non-admin user must get no more than anon.
describe("signed-in non-admin", () => {
  it("sees only published products", async () => {
    await as(db, "authenticated", customerId, async () => {
      expect(await rows(`SELECT id FROM public.products WHERE id = $1`, [draftId])).toHaveLength(0);
    });
  });

  it("cannot change products (RLS blocks the write)", async () => {
    await as(db, "authenticated", customerId, async () => {
      await expect(db.query(`INSERT INTO public.products (slug, name, price_paise) VALUES ('x', 'x', 1)`)).rejects.toThrow(/row-level security/);
      const updated = await db.query(`UPDATE public.products SET price_paise = 1 WHERE id = $1`, [publishedId]);
      expect(updated.affectedRows).toBe(0);
    });
    expect(await rows(`SELECT price_paise FROM public.products WHERE id = $1`, [publishedId])).toEqual([{ price_paise: 90000 }]);
  });

  it("cannot read orders", async () => {
    await as(db, "authenticated", customerId, async () => {
      expect(await rows(`SELECT * FROM public.orders`)).toHaveLength(0);
    });
  });

  // Only the 3 admins should ever have accounts (sign-ups off), but if a
  // non-admin account exists it must not see orders or write anything.
  it("cannot read any order data or write any table", async () => {
    await as(db, "authenticated", customerId, async () => {
      for (const t of ["orders", "order_items", "order_events", "email_queue"]) {
        expect(await rows(`SELECT * FROM public.${t}`), t).toHaveLength(0);
      }
      await expect(db.query(`SELECT * FROM public.rate_limits`)).rejects.toThrow(/permission denied/);
      const writes = [
        `INSERT INTO public.orders (number, name, phone, address, city, state, pincode, subtotal_paise, total_paise) VALUES ('X', 'x', '9', 'x', 'x', 'x', '411001', 0, 0)`,
        `INSERT INTO public.order_items (order_id, slug, name, size, qty, unit_price_paise) SELECT id, 's', 'n', 'M', 1, 1 FROM public.orders`,
        `INSERT INTO public.email_queue (order_id, kind, to_email, payload) VALUES (gen_random_uuid(), 'shipped', 'a@b.c', '{}')`,
        `INSERT INTO public.delivery_zones (name, pincode_prefix, min_days, max_days) VALUES ('x', '4', 1, 2)`,
        `INSERT INTO public.variants (product_id, size) VALUES ('${publishedId}', 'XS')`,
        `INSERT INTO public.edits (slug, title) VALUES ('y', 'y')`,
        `INSERT INTO storage.objects (bucket_id, name) VALUES ('site-assets', 'qr.png')`,
        `INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'x.webp')`,
        `UPDATE public.orders SET status = 'paid'`,
        `INSERT INTO public.admin_audit_log (action) VALUES ('x')`,
      ];
      for (const sql of writes) await expect(db.query(sql), sql).rejects.toThrow(/permission denied|row-level security/);
      const updates = [
        `UPDATE public.settings SET upi_id = 'evil@upi'`,
        `UPDATE public.variants SET stock = 99`,
        `DELETE FROM public.products`,
        `DELETE FROM public.delivery_zones`,
      ];
      for (const sql of updates) expect((await db.query(sql)).affectedRows, sql).toBe(0);
      await expect(db.query(`SELECT public.admin_set_stock($1, 9)`, [publishedId])).rejects.toThrow(/forbidden/);
      await expect(db.query(`SELECT public.admin_dashboard()`)).rejects.toThrow(/forbidden/);
      await expect(db.query(`SELECT public.admin_set_order_status(gen_random_uuid(), 'paid')`)).rejects.toThrow(/forbidden/);
      await expect(db.query(`SELECT public.admin_login_begin('x', '1.2.3.4')`)).rejects.toThrow(/permission denied/);
      expect(await rows(`SELECT * FROM public.admin_audit_log`)).toHaveLength(0);
      await expect(db.query(`SELECT public.place_order('{}', '[]', '')`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`SELECT public.cancel_expired_orders()`)).rejects.toThrow(/permission denied/);
    });
    expect(await rows(`SELECT upi_id FROM public.settings`)).toEqual([{ upi_id: null }]);
    expect(await rows(`SELECT status FROM public.orders WHERE number = 'K7Q2M9'`)).toEqual([{ status: "awaiting_payment" }]);
  });

  it("reads only their own profile and cannot promote themselves", async () => {
    await as(db, "authenticated", customerId, async () => {
      expect(await rows(`SELECT id FROM public.profiles`)).toEqual([{ id: customerId }]);
      await expect(db.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [customerId])).rejects.toThrow(/permission denied/);
    });
  });
});

describe("admin", () => {
  it("is recognised by is_admin()", async () => {
    await as(db, "authenticated", adminId, async () => {
      expect(await rows(`SELECT public.is_admin() AS a`)).toEqual([{ a: true }]);
    });
  });

  it("can read drafts, write products and read orders", async () => {
    await as(db, "authenticated", adminId, async () => {
      expect(await rows(`SELECT id FROM public.products`)).toHaveLength(2);
      await db.query(`UPDATE public.variants SET stock = 5 WHERE product_id = $1`, [publishedId]);
      expect(await rows(`SELECT number FROM public.orders`)).toEqual([{ number: "K7Q2M9" }]);
      await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'products/shirt/1.webp')`);
    });
    expect(await rows(`SELECT stock FROM public.variants WHERE product_id = $1`, [publishedId])).toEqual([{ stock: 5 }]);
  });

  it("cannot write to other storage buckets", async () => {
    await db.exec(`INSERT INTO storage.buckets (id, name) VALUES ('other', 'other')`);
    await as(db, "authenticated", adminId, async () => {
      await expect(db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('other', 'x')`)).rejects.toThrow(/row-level security/);
    });
  });
});

describe("edits", () => {
  let editId: string;
  beforeAll(async () => {
    const e = await db.query<{ id: string }>(
      `INSERT INTO public.edits (slug, title, published) VALUES ('live', 'Live edit', true), ('draft-edit', 'Draft edit', false) RETURNING id`,
    );
    editId = e.rows[0].id;
    await db.query(`INSERT INTO public.edit_items (edit_id, product_id, position) VALUES ($1, $2, 0), ($1, $3, 1), ($4, $2, 0)`, [
      editId,
      publishedId,
      draftId,
      e.rows[1].id,
    ]);
  });

  it("anon sees published edits and only their published products", async () => {
    await as(db, "anon", null, async () => {
      expect(await rows(`SELECT slug FROM public.edits`)).toEqual([{ slug: "live" }]);
      expect(await rows(`SELECT product_id FROM public.edit_items`)).toEqual([{ product_id: publishedId }]);
    });
  });

  it("anon and customers cannot write edits", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`INSERT INTO public.edits (slug, title) VALUES ('x', 'x')`)).rejects.toThrow(/permission denied/);
    });
    await as(db, "authenticated", customerId, async () => {
      await expect(db.query(`INSERT INTO public.edits (slug, title) VALUES ('x', 'x')`)).rejects.toThrow(/row-level security/);
      await expect(db.query(`DELETE FROM public.edit_items`)).resolves.toMatchObject({ affectedRows: 0 });
    });
  });

  it("admins can curate edits", async () => {
    await as(db, "authenticated", adminId, async () => {
      await db.query(`UPDATE public.edit_items SET position = 5 WHERE edit_id = $1 AND product_id = $2`, [editId, publishedId]);
      expect(await rows(`SELECT count(*)::int AS n FROM public.edits`)).toEqual([{ n: 2 }]);
    });
  });

  it("media bucket is publicly readable (copied to the static site) but not writable", async () => {
    expect(await rows(`SELECT public FROM storage.buckets WHERE id = 'product-media'`)).toEqual([{ public: true }]);
  });

  it("anon cannot upload to the media bucket", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-media', 'v.mp4')`)).rejects.toThrow(/row-level security/);
    });
  });
});

describe("constraints", () => {
  it("rejects negative prices and stock, and out-of-range shirt numbers", async () => {
    await expect(db.query(`INSERT INTO public.products (slug, name, price_paise) VALUES ('n', 'n', -1)`)).rejects.toThrow(/products_price_nonnegative/);
    await expect(db.query(`UPDATE public.variants SET stock = -1`)).rejects.toThrow(/variants_stock_nonnegative/);
    await expect(db.query(`UPDATE public.products SET number = 100`)).rejects.toThrow(/products_number_range/);
  });

  it("limits detail videos to 2 MB and 5–8 seconds", async () => {
    const set = (v: object) => db.query(`UPDATE public.products SET video = $1 WHERE id = $2`, [JSON.stringify(v), publishedId]);
    await expect(set({ path: "v.mp4", poster: "p.webp", bytes: 1_500_000, durationMs: 6000 })).resolves.toBeDefined();
    await expect(set({ path: "v.mp4", poster: "p.webp", bytes: 3_000_000, durationMs: 6000 })).rejects.toThrow(/products_video_limits/);
    await expect(set({ path: "v.mp4", poster: "p.webp", bytes: 1_000_000, durationMs: 12000 })).rejects.toThrow(/products_video_limits/);
  });

  it("keeps orders guest-only (no user link)", async () => {
    expect(await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id'`)).toEqual([]);
  });

  it("treats admin usernames as case-insensitive", async () => {
    await expect(db.query(`UPDATE public.profiles SET username = 'admin-one' WHERE id = $1`, [customerId])).rejects.toThrow(/duplicate key/);
  });
});
