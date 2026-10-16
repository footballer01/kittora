"use client";

// Admin reads and writes, all through the public client with the admin's
// session: RLS and the admin_* functions in Postgres decide what's allowed.
import { compressImage } from "@/lib/images/compress";
import type { OrderStatus } from "@/lib/checkout/api";
import { db } from "./session";

export type AdminImage = { id: string; storage_path: string; kind: "front" | "back" | "detail" | "other"; position: number; width: number | null; height: number | null; alt: string };
export type AdminVariant = { id: string; size: string; stock: number | null; position: number };
export type Video = { path: string; poster: string; bytes: number; durationMs: number };
export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  club: string | null;
  country: string | null;
  player: string | null;
  number: number | null;
  season: string | null;
  kit_type: "home" | "away" | "third" | "retro" | "special" | null;
  fit: string | null;
  audience: ("men" | "women" | "kids")[];
  description: string | null;
  story: string | null;
  story_title: string | null;
  video: Video | null;
  price_paise: number;
  track_stock: boolean;
  featured: boolean;
  featured_position: number | null;
  published: boolean;
  updated_at: string;
  product_images: AdminImage[];
  variants: AdminVariant[];
};
export type OrderItem = { id: string; slug: string; name: string; size: string; qty: number; unit_price_paise: number };
export type AdminOrder = {
  id: string;
  number: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: OrderStatus;
  subtotal_paise: number;
  shipping_paise: number;
  total_paise: number;
  utr: string | null;
  payment_proof_path: string | null;
  tracking_note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
};
export type Dashboard = {
  orders_today: number;
  revenue_week_paise: number;
  payments_to_verify: number;
  to_pack: number;
  low_stock: { id: string; name: string; size: string; stock: number }[];
  storage_bytes: number;
  storage_limit_bytes: number;
  email: Partial<Record<"pending" | "sent" | "skipped" | "failed", number>>;
};
export type AuditEntry = { id: string; action: string; entity: string | null; details: Record<string, unknown> | null; created_at: string; actor_id: string | null };
export type Edit = { id: string; slug: string; title: string; description: string | null; position: number; published: boolean; edit_items: { product_id: string; position: number }[] };
export type Zone = { id: string; name: string; pincode_prefix: string; min_days: number; max_days: number; cod_available: boolean };

const PRODUCT_COLUMNS =
  "id, slug, name, club, country, player, number, season, kit_type, fit, audience, description, story, story_title, video, price_paise, track_stock, featured, featured_position, published, updated_at, product_images(id, storage_path, kind, position, width, height, alt), variants(id, size, stock, position)";

/** Throw Postgres/Storage errors with a readable message. */
function check<T>(r: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (r.error) {
    const m = r.error.message;
    if (r.error.code === "23505") throw new Error(`${what}: that already exists (slug, size or prefix must be unique).`);
    throw new Error(`${what}: ${/^[a-z_]+$/.test(m) ? m.replace(/_/g, " ") : m}`);
  }
  return r.data;
}

export const publicUrl = (bucket: string, path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

const sortProduct = (p: AdminProduct): AdminProduct => ({
  ...p,
  product_images: [...p.product_images].sort((a, b) => a.position - b.position),
  variants: [...p.variants].sort((a, b) => a.position - b.position),
});

// --- Dashboard -------------------------------------------------------------
export async function getDashboard(): Promise<Dashboard> {
  return check(await (await db()).rpc("admin_dashboard"), "Dashboard") as Dashboard;
}
export async function getRecentActivity(limit = 8): Promise<AuditEntry[]> {
  return check(await (await db()).from("admin_audit_log").select("id, action, entity, details, created_at, actor_id").order("created_at", { ascending: false }).limit(limit), "Activity") as AuditEntry[];
}

// --- Products --------------------------------------------------------------
export async function listProducts(): Promise<AdminProduct[]> {
  const rows = check(await (await db()).from("products").select(PRODUCT_COLUMNS).order("name"), "Products") as AdminProduct[];
  return rows.map(sortProduct);
}
export async function getProduct(id: string): Promise<AdminProduct> {
  return sortProduct(check(await (await db()).from("products").select(PRODUCT_COLUMNS).eq("id", id).single(), "Product") as AdminProduct);
}
export async function saveProduct(id: string | null, values: Record<string, unknown>): Promise<string> {
  const client = await db();
  if (id) {
    check(await client.from("products").update(values).eq("id", id), "Save");
    return id;
  }
  return (check(await client.from("products").insert(values).select("id").single(), "Create") as { id: string }).id;
}
export async function deleteProduct(id: string) {
  check(await (await db()).from("products").delete().eq("id", id), "Delete");
}

/** Make the sizes match `sizes` (in order), with their stock boxes. */
export async function saveVariants(productId: string, existing: AdminVariant[], sizes: { size: string; stock: number | null }[]) {
  const client = await db();
  const keep = new Set(sizes.map((s) => s.size));
  const gone = existing.filter((v) => !keep.has(v.size)).map((v) => v.id);
  if (gone.length) check(await client.from("variants").delete().in("id", gone), "Remove sizes");
  if (sizes.length)
    check(
      await client.from("variants").upsert(
        sizes.map((s, i) => ({ product_id: productId, size: s.size, stock: s.stock, position: i })),
        { onConflict: "product_id,size" },
      ),
      "Save sizes",
    );
}
export async function setStockForAllSizes(productId: string, stock: number) {
  check(await (await db()).rpc("admin_set_stock", { p_product: productId, p_stock: stock }), "Set stock");
}

// --- Images and video ------------------------------------------------------
export async function uploadProductImage(product: AdminProduct, file: File, kind: AdminImage["kind"]): Promise<void> {
  const client = await db();
  const { blob, width, height } = await compressImage(file);
  const path = `products/${product.slug}/${crypto.randomUUID().slice(0, 8)}.webp`;
  check(await client.storage.from("product-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" }), "Upload");
  const position = product.product_images.reduce((m, i) => Math.max(m, i.position + 1), 0);
  check(
    await client.from("product_images").insert({ product_id: product.id, storage_path: path, width, height, alt: product.name, kind, position }),
    "Save photo",
  );
}
export async function setImageKind(image: AdminImage, kind: AdminImage["kind"], all: AdminImage[]) {
  const client = await db();
  // Only one front and one back photo: the previous one becomes an extra.
  if (kind === "front" || kind === "back") {
    const prev = all.filter((i) => i.kind === kind && i.id !== image.id).map((i) => i.id);
    if (prev.length) check(await client.from("product_images").update({ kind: "detail" }).in("id", prev), "Photo type");
  }
  check(await client.from("product_images").update({ kind }).eq("id", image.id), "Photo type");
}
export async function reorderImages(productId: string, ids: string[]) {
  check(await (await db()).rpc("admin_reorder_images", { p_product: productId, p_ids: ids }), "Reorder");
}
export async function deleteImage(image: AdminImage) {
  const client = await db();
  check(await client.from("product_images").delete().eq("id", image.id), "Delete photo");
  await client.storage.from("product-images").remove([image.storage_path]);
}

export const VIDEO_MAX_BYTES = 2 * 1024 * 1024;

/** Duration and a WebP poster from the first frame, in the browser. */
async function inspectVideo(file: File): Promise<{ durationMs: number; poster: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("This video can't be read. Use MP4 or WebM."));
    });
    const durationMs = Math.round(v.duration * 1000);
    v.currentTime = Math.min(0.1, v.duration / 2);
    await new Promise((ok) => (v.onseeked = ok));
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const poster = await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Poster failed"))), "image/webp", 0.8));
    return { durationMs, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadProductVideo(product: AdminProduct, file: File): Promise<Video> {
  if (file.size > VIDEO_MAX_BYTES) throw new Error(`The video is ${(file.size / 1048576).toFixed(1)} MB. The limit is 2 MB.`);
  if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error("Use an MP4 or WebM video.");
  const { durationMs, poster } = await inspectVideo(file);
  if (durationMs < 5000 || durationMs > 8000) throw new Error(`The video is ${(durationMs / 1000).toFixed(1)} s. Use a 5–8 second clip.`);
  const client = await db();
  const id = crypto.randomUUID().slice(0, 8);
  const ext = file.type === "video/webm" ? "webm" : "mp4";
  const path = `products/${product.slug}/video-${id}.${ext}`;
  const posterPath = `products/${product.slug}/poster-${id}.webp`;
  check(await client.storage.from("product-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" }), "Upload video");
  check(await client.storage.from("product-media").upload(posterPath, poster, { contentType: "image/webp", cacheControl: "31536000" }), "Upload poster");
  const video: Video = { path, poster: posterPath, bytes: file.size, durationMs };
  check(await client.from("products").update({ video }).eq("id", product.id), "Save video");
  if (product.video) await client.storage.from("product-media").remove([product.video.path, product.video.poster]);
  return video;
}
export async function removeProductVideo(product: AdminProduct) {
  const client = await db();
  check(await client.from("products").update({ video: null }).eq("id", product.id), "Remove video");
  if (product.video) await client.storage.from("product-media").remove([product.video.path, product.video.poster]);
}

// --- Edits -----------------------------------------------------------------
export async function listEdits(): Promise<Edit[]> {
  const rows = check(await (await db()).from("edits").select("id, slug, title, description, position, published, edit_items(product_id, position)").order("position"), "Edits") as Edit[];
  return rows.map((e) => ({ ...e, edit_items: [...e.edit_items].sort((a, b) => a.position - b.position) }));
}
export async function saveEdit(id: string | null, values: { slug: string; title: string; description: string | null; published: boolean; position?: number }) {
  const client = await db();
  if (id) check(await client.from("edits").update(values).eq("id", id), "Save edit");
  else check(await client.from("edits").insert(values), "Create edit");
}
export async function deleteEdit(id: string) {
  check(await (await db()).from("edits").delete().eq("id", id), "Delete edit");
}
export async function setEditPositions(ids: string[]) {
  const client = await db();
  await Promise.all(ids.map(async (id, i) => check(await client.from("edits").update({ position: i }).eq("id", id), "Reorder edits")));
}
export async function setEditProducts(editId: string, productIds: string[]) {
  const client = await db();
  check(await client.from("edit_items").delete().eq("edit_id", editId), "Edit products");
  if (productIds.length) check(await client.from("edit_items").insert(productIds.map((p, i) => ({ edit_id: editId, product_id: p, position: i }))), "Edit products");
}

// --- Orders ----------------------------------------------------------------
export async function listOrders(status: OrderStatus | "all", search: string): Promise<AdminOrder[]> {
  let q = (await db())
    .from("orders")
    .select("id, number, name, phone, email, address, city, state, pincode, status, subtotal_paise, shipping_paise, total_paise, utr, payment_proof_path, tracking_note, expires_at, created_at, updated_at, order_items(id, slug, name, size, qty, unit_price_paise)")
    .order("created_at", { ascending: status === "payment_submitted" || status === "paid" || status === "packed" })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  const s = search.trim().replace(/[^A-Za-z0-9 ]/g, "");
  if (s) q = q.or(`number.ilike.%${s.toUpperCase()}%,phone.ilike.%${s.replace(/\D/g, "") || "-"}%,name.ilike.%${s}%`);
  return check(await q, "Orders") as AdminOrder[];
}
export async function getOrderByNumber(number: string): Promise<AdminOrder | null> {
  const rows = check(
    await (await db()).from("orders").select("*, order_items(id, slug, name, size, qty, unit_price_paise)").eq("number", number.toUpperCase()).limit(1),
    "Order",
  ) as AdminOrder[];
  return rows[0] ?? null;
}
export async function proofUrl(path: string): Promise<string | null> {
  const { data } = await (await db()).storage.from("payment-proofs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
export async function setOrderStatus(orderId: string, status: OrderStatus, note?: string) {
  check(await (await db()).rpc("admin_set_order_status", { p_order: orderId, p_status: status, p_note: note ?? null }), "Update order");
}

// --- Settings and zones ----------------------------------------------------
export type SettingsRow = Record<string, string | number | boolean | null>;
export async function getSettings(): Promise<SettingsRow> {
  return check(await (await db()).from("settings").select("*").single(), "Settings") as SettingsRow;
}
export async function saveSettings(values: SettingsRow) {
  check(await (await db()).from("settings").update(values).eq("id", true), "Save settings");
}
export async function uploadQr(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPG or WebP image.");
  if (file.size > 1048576) throw new Error("The QR image must be under 1 MB.");
  const path = `qr/${crypto.randomUUID().slice(0, 8)}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
  check(await (await db()).storage.from("site-assets").upload(path, file, { contentType: file.type }), "Upload QR");
  return path;
}

export async function listZones(): Promise<Zone[]> {
  return check(await (await db()).from("delivery_zones").select("id, name, pincode_prefix, min_days, max_days, cod_available").order("pincode_prefix"), "Zones") as Zone[];
}
export async function saveZone(id: string | null, z: Omit<Zone, "id">) {
  const client = await db();
  if (id) check(await client.from("delivery_zones").update(z).eq("id", id), "Save zone");
  else check(await client.from("delivery_zones").insert(z), "Add zone");
}
export async function deleteZone(id: string) {
  check(await (await db()).from("delivery_zones").delete().eq("id", id), "Delete zone");
}
export async function importZones(rows: Omit<Zone, "id">[]) {
  check(await (await db()).from("delivery_zones").upsert(rows, { onConflict: "pincode_prefix" }), "Import zones");
}

// --- Publish ---------------------------------------------------------------
export type DeployRun = { status: string; conclusion: string | null; created_at: string; html_url: string };
export async function publish(action: "publish" | "status"): Promise<{ run?: DeployRun | null; started?: boolean; error?: string }> {
  const client = await db();
  const { data } = await client.auth.getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ action }),
  });
  return res.json().catch(() => ({ error: "server_error" }));
}
