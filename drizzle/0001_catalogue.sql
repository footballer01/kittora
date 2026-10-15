CREATE TYPE "public"."audience" AS ENUM('men', 'women', 'kids');--> statement-breakpoint
CREATE TYPE "public"."kit_type" AS ENUM('home', 'away', 'third', 'retro', 'special');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_payment', 'payment_submitted', 'paid', 'packed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"user_id" uuid,
	"phone" text NOT NULL,
	"email" text,
	"status" "order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"total_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_total_nonnegative" CHECK ("orders"."total_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"v1_id" text,
	"sku" text,
	"name" text NOT NULL,
	"club" text,
	"country" text,
	"player" text,
	"number" integer,
	"season" text,
	"kit_type" "kit_type",
	"fit" text,
	"audience" "audience"[] DEFAULT '{}' NOT NULL,
	"description" text,
	"price_paise" integer NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"featured_position" integer,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_v1_id_unique" UNIQUE("v1_id"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_price_nonnegative" CHECK ("products"."price_paise" >= 0),
	CONSTRAINT "products_number_range" CHECK ("products"."number" is null or "products"."number" between 0 and 99)
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"size" text NOT NULL,
	"stock" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_stock_nonnegative" CHECK ("variants"."stock" is null or "variants"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_position_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "products_club_idx" ON "products" USING btree ("club");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_idx" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_size_idx" ON "variants" USING btree ("product_id","size");--> statement-breakpoint
CREATE POLICY "orders: admin read" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "orders: admin update" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "product_images: public read" ON "product_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.products p where p.id = "product_images"."product_id" and p.published));--> statement-breakpoint
CREATE POLICY "product_images: admin read all" ON "product_images" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "product_images: admin insert" ON "product_images" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "product_images: admin update" ON "product_images" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "product_images: admin delete" ON "product_images" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "products: public read published" ON "products" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("products"."published");--> statement-breakpoint
CREATE POLICY "products: admin read all" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "products: admin insert" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "products: admin update" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "products: admin delete" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "profiles: read own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles: admin read" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "variants: public read" ON "variants" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.products p where p.id = "variants"."product_id" and p.published));--> statement-breakpoint
CREATE POLICY "variants: admin read all" ON "variants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "variants: admin insert" ON "variants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "variants: admin update" ON "variants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "variants: admin delete" ON "variants" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));