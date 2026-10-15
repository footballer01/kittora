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
  await db.query(`INSERT INTO public.orders (number, phone, total_paise) VALUES ('K7Q2M9', '9999999999', 90000)`);
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

describe("signed-in customer", () => {
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

describe("constraints", () => {
  it("rejects negative prices and stock, and out-of-range shirt numbers", async () => {
    await expect(db.query(`INSERT INTO public.products (slug, name, price_paise) VALUES ('n', 'n', -1)`)).rejects.toThrow(/products_price_nonnegative/);
    await expect(db.query(`UPDATE public.variants SET stock = -1`)).rejects.toThrow(/variants_stock_nonnegative/);
    await expect(db.query(`UPDATE public.products SET number = 100`)).rejects.toThrow(/products_number_range/);
  });

  it("treats admin usernames as case-insensitive", async () => {
    await expect(db.query(`UPDATE public.profiles SET username = 'admin-one' WHERE id = $1`, [customerId])).rejects.toThrow(/duplicate key/);
  });
});
