// Database schema. Drizzle generates migrations from this file; it is never
// imported by the site (the browser talks to Supabase with the anon key).
//
// Security model: RLS is on for every table. Anyone may read published
// catalogue rows. Only admins (profiles.role = 'admin', checked by the
// SECURITY DEFINER function public.is_admin()) may write. Orders are not
// readable or writable directly; Phase 3 adds SECURITY DEFINER functions for
// placing and looking up orders.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUsers } from "drizzle-orm/supabase";

const isAdmin = sql`(select public.is_admin())`;
const everyone = [anonRole, authenticatedRole];

export const roleEnum = pgEnum("user_role", ["customer", "admin"]);
export const audienceEnum = pgEnum("audience", ["men", "women", "kids"]);
export const kitTypeEnum = pgEnum("kit_type", ["home", "away", "third", "retro", "special"]);
export const imageKindEnum = pgEnum("image_kind", ["front", "back", "detail", "other"]);
export const orderStatusEnum = pgEnum("order_status", [
  "awaiting_payment",
  "payment_submitted",
  "paid",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("customer"),
    // Admin login name; unique ignoring case. Null for customers.
    username: text("username"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_username_lower_idx").on(sql`lower(${t.username})`),
    pgPolicy("profiles: read own", { for: "select", to: authenticatedRole, using: sql`${t.id} = (select auth.uid())` }),
    pgPolicy("profiles: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
    // No insert/update/delete policies: rows are created by a trigger on
    // auth.users and roles are changed only with the service role.
  ],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    v1Id: text("v1_id").unique(),
    sku: text("sku").unique(),
    name: text("name").notNull(),
    club: text("club"),
    country: text("country"),
    // Filled in by admins — never inferred from the name.
    player: text("player"),
    number: integer("number"),
    season: text("season"),
    kitType: kitTypeEnum("kit_type"),
    fit: text("fit"),
    audience: audienceEnum("audience").array().notNull().default(sql`'{}'`),
    description: text("description"),
    // Optional editorial "kit story" shown on the product page. Hidden when null.
    story: text("story"),
    storyTitle: text("story_title"),
    // Optional silent detail video (5–8 s, ≤ 2 MB). Served from the static site;
    // paths point into the product-media bucket, copied at publish time.
    video: jsonb("video").$type<{ path: string; poster: string; bytes: number; durationMs: number }>(),
    pricePaise: integer("price_paise").notNull(),
    featured: boolean("featured").notNull().default(false),
    featuredPosition: integer("featured_position"),
    published: boolean("published").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("products_price_nonnegative", sql`${t.pricePaise} >= 0`),
    check("products_number_range", sql`${t.number} is null or ${t.number} between 0 and 99`),
    check(
      "products_video_limits",
      sql`${t.video} is null or ((${t.video}->>'bytes')::int <= 2097152 and (${t.video}->>'durationMs')::int between 5000 and 8000 and ${t.video} ? 'path' and ${t.video} ? 'poster')`,
    ),
    index("products_club_idx").on(t.club),
    pgPolicy("products: public read published", { for: "select", to: everyone, using: sql`${t.published}` }),
    pgPolicy("products: admin read all", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("products: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("products: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("products: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

const publishedProduct = (productId: unknown) =>
  sql`exists (select 1 from public.products p where p.id = ${productId} and p.published)`;

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Path inside the public `product-images` storage bucket.
    storagePath: text("storage_path").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    // front/back drive the card crossfade; no back image = no effect.
    kind: imageKindEnum("kind").notNull().default("other"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("product_images_product_position_idx").on(t.productId, t.position),
    pgPolicy("product_images: public read", { for: "select", to: everyone, using: publishedProduct(t.productId) }),
    pgPolicy("product_images: admin read all", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("product_images: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("product_images: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("product_images: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    // Null = not set yet (v1 only says "In stock"); admins fill real counts.
    stock: integer("stock"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("variants_product_size_idx").on(t.productId, t.size),
    check("variants_stock_nonnegative", sql`${t.stock} is null or ${t.stock} >= 0`),
    pgPolicy("variants: public read", { for: "select", to: everyone, using: publishedProduct(t.productId) }),
    pgPolicy("variants: admin read all", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("variants: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("variants: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("variants: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

// Curated edits: admin-defined, ordered groups of products shown as named
// rails on home and as "From the same edit" on product pages.
export const edits = pgTable(
  "edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    pgPolicy("edits: public read published", { for: "select", to: everyone, using: sql`${t.published}` }),
    pgPolicy("edits: admin read all", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("edits: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("edits: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("edits: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

export const editItems = pgTable(
  "edit_items",
  {
    editId: uuid("edit_id")
      .notNull()
      .references(() => edits.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.editId, t.productId] }),
    pgPolicy("edit_items: public read", {
      for: "select",
      to: everyone,
      using: sql`exists (select 1 from public.edits e where e.id = ${t.editId} and e.published) and ${publishedProduct(t.productId)}`,
    }),
    pgPolicy("edit_items: admin read all", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("edit_items: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("edit_items: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("edit_items: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

// Minimal now so RLS can be verified; Phase 3 adds address, items, UTR,
// place_order() and lookup functions.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    email: text("email"),
    status: orderStatusEnum("status").notNull().default("awaiting_payment"),
    totalPaise: integer("total_paise").notNull(),
    ...timestamps,
  },
  (t) => [
    check("orders_total_nonnegative", sql`${t.totalPaise} >= 0`),
    pgPolicy("orders: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("orders: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    // No public insert: orders are created only by place_order() (Phase 3).
  ],
).enableRLS();
