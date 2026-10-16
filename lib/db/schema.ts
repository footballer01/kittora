// Database schema. Drizzle generates migrations from this file; it is never
// imported by the site (the browser talks to Supabase with the anon key).
//
// Security model: RLS is on for every table. There are no customer accounts
// (guest checkout; wishlist in localStorage). Anyone may read published
// catalogue rows. Only admins (profiles.role = 'admin', checked by the
// SECURITY DEFINER function public.is_admin()) may write. Orders are not
// readable or writable by the public: place_order() (called by the place-order
// Edge Function after Turnstile), track_order() and submit_payment() are the
// only ways in, all SECURITY DEFINER (drizzle/0008_checkout_functions.sql).
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

// Only admins sign in. "customer" stays in the enum (Postgres can't drop enum
// values cheaply) as the inert default for any non-admin auth user.
export const emailKindEnum = pgEnum("email_kind", ["order_placed", "payment_confirmed", "shipped", "packed", "delivered", "cancelled"]);
export const emailStatusEnum = pgEnum("email_status", ["pending", "sent", "skipped", "failed"]);
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
    // Admin login name; unique ignoring case.
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
    // Off: every size can always be ordered and stock numbers are ignored
    // (v1 had no counts). On: variants.stock is enforced; null counts as 0.
    trackStock: boolean("track_stock").notNull().default(false),
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

// Guest checkout only: no customer accounts, so orders belong to no user.
// Customers track orders by order number + phone. Rows are written only by the
// SECURITY DEFINER functions in 0008 and by admins.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Random, non-sequential (new_order_number()).
    number: text("number").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    status: orderStatusEnum("status").notNull().default("awaiting_payment"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    shippingPaise: integer("shipping_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    utr: text("utr"),
    // Object in the private payment-proofs bucket, under <upload_key>/.
    paymentProofPath: text("payment_proof_path"),
    // Secret folder name for the screenshot upload; given only to whoever placed the order.
    uploadKey: uuid("upload_key").notNull().defaultRandom().unique(),
    // md5 of the client IP, only to cap unpaid orders per IP.
    ipHash: text("ip_hash"),
    // Shown to the customer once shipped (courier + tracking number). Admin-set.
    trackingNote: text("tracking_note"),
    // Unpaid orders auto-cancel after this (null = never: no timeout and no stock held).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("orders_total_nonnegative", sql`${t.totalPaise} >= 0`),
    check("orders_total_sum", sql`${t.totalPaise} = ${t.subtotalPaise} + ${t.shippingPaise}`),
    index("orders_phone_status_idx").on(t.phone, t.status),
    index("orders_status_expires_idx").on(t.status, t.expiresAt),
    pgPolicy("orders: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
    // Admins change orders only through admin_set_order_status() (0010), which
    // enforces the status flow; the table itself is not writable from the browser.
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    // Copied at order time so the order reads the same if the product changes.
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    size: text("size").notNull(),
    qty: integer("qty").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    // True while this line holds stock (tracked products only); released on cancel.
    reserved: boolean("reserved").notNull().default(false),
  },
  (t) => [
    check("order_items_qty_range", sql`${t.qty} between 1 and 5`),
    index("order_items_order_idx").on(t.orderId),
    pgPolicy("order_items: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId),
    pgPolicy("order_events: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

// Store settings: exactly one row. Empty/0 by default; the storefront hides
// empty fields. Public read (nothing here is secret), admin update.
export const settings = pgTable(
  "settings",
  {
    id: boolean("id").primaryKey().default(true),
    upiId: text("upi_id"),
    payeeName: text("payee_name"),
    // Path in the public site-assets bucket.
    qrImagePath: text("qr_image_path"),
    whatsappNumber: text("whatsapp_number"),
    // 0 = unpaid orders never auto-cancel.
    unpaidTimeoutMinutes: integer("unpaid_timeout_minutes").notNull().default(0),
    shippingFeePaise: integer("shipping_fee_paise").notNull().default(0),
    // 0 = no free-shipping threshold.
    freeShippingThresholdPaise: integer("free_shipping_threshold_paise").notNull().default(0),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactAddress: text("contact_address"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    youtubeUrl: text("youtube_url"),
    xUrl: text("x_url"),
    // Policy page text (plain text, blank lines = paragraphs). Empty = page hidden.
    shippingPolicy: text("shipping_policy"),
    returnsPolicy: text("returns_policy"),
    termsText: text("terms_text"),
    privacyText: text("privacy_text"),
    ...timestamps,
  },
  (t) => [
    check("settings_singleton", sql`${t.id}`),
    check(
      "settings_nonnegative",
      sql`${t.unpaidTimeoutMinutes} >= 0 and ${t.shippingFeePaise} >= 0 and ${t.freeShippingThresholdPaise} >= 0`,
    ),
    pgPolicy("settings: public read", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("settings: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
  ],
).enableRLS();

// Delivery estimates by pincode prefix ("4" = all of 4xxxxx, "411" = Pune…);
// the longest matching prefix wins. No rows = no estimate shown.
export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    pincodePrefix: text("pincode_prefix").notNull().unique(),
    minDays: integer("min_days").notNull(),
    maxDays: integer("max_days").notNull(),
    // Recorded for a future courier integration; checkout stays UPI-only.
    codAvailable: boolean("cod_available").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check("delivery_zones_prefix", sql`${t.pincodePrefix} ~ '^[0-9]{1,6}$'`),
    check("delivery_zones_days", sql`${t.minDays} >= 0 and ${t.maxDays} >= ${t.minDays}`),
    pgPolicy("delivery_zones: public read", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("delivery_zones: admin insert", { for: "insert", to: authenticatedRole, withCheck: isAdmin }),
    pgPolicy("delivery_zones: admin update", { for: "update", to: authenticatedRole, using: isAdmin, withCheck: isAdmin }),
    pgPolicy("delivery_zones: admin delete", { for: "delete", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

// Outgoing customer email, filled by triggers and drained by the send-email
// Edge Function (service role). Never readable by the public.
export const emailQueue = pgTable(
  "email_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: emailKindEnum("kind").notNull(),
    toEmail: text("to_email").notNull(),
    payload: jsonb("payload").notNull(),
    status: emailStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("email_queue_order_kind_idx").on(t.orderId, t.kind),
    index("email_queue_pending_idx").on(t.status, t.nextAttemptAt),
    pgPolicy("email_queue: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();

// Fixed-window counters for rate limits. Touched only by SECURITY DEFINER functions.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
).enableRLS();

// Every admin write (by trigger, so it can't be skipped from the browser) and
// every admin sign-in attempt (by the admin-login Edge Function). Admins can
// read it; nobody can change or delete it.
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => authUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_log_created_idx").on(t.createdAt),
    pgPolicy("admin_audit_log: admin read", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
).enableRLS();
