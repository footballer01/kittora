CREATE TYPE "public"."email_kind" AS ENUM('order_placed', 'payment_confirmed', 'shipped');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"pincode_prefix" text NOT NULL,
	"min_days" integer NOT NULL,
	"max_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_zones_pincode_prefix_unique" UNIQUE("pincode_prefix"),
	CONSTRAINT "delivery_zones_prefix" CHECK ("delivery_zones"."pincode_prefix" ~ '^[0-9]{1,6}$'),
	CONSTRAINT "delivery_zones_days" CHECK ("delivery_zones"."min_days" >= 0 and "delivery_zones"."max_days" >= "delivery_zones"."min_days")
);
--> statement-breakpoint
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "email_kind" NOT NULL,
	"to_email" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"size" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"reserved" boolean DEFAULT false NOT NULL,
	CONSTRAINT "order_items_qty_range" CHECK ("order_items"."qty" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"upi_id" text,
	"payee_name" text,
	"qr_image_path" text,
	"whatsapp_number" text,
	"unpaid_timeout_minutes" integer DEFAULT 0 NOT NULL,
	"shipping_fee_paise" integer DEFAULT 0 NOT NULL,
	"free_shipping_threshold_paise" integer DEFAULT 0 NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"contact_address" text,
	"instagram_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id"),
	CONSTRAINT "settings_nonnegative" CHECK ("settings"."unpaid_timeout_minutes" >= 0 and "settings"."shipping_fee_paise" >= 0 and "settings"."free_shipping_threshold_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "state" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pincode" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_paise" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utr" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_path" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "upload_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "track_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_queue_order_kind_idx" ON "email_queue" USING btree ("order_id","kind");--> statement-breakpoint
CREATE INDEX "email_queue_pending_idx" ON "email_queue" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_phone_status_idx" ON "orders" USING btree ("phone","status");--> statement-breakpoint
CREATE INDEX "orders_status_expires_idx" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_upload_key_unique" UNIQUE("upload_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_sum" CHECK ("orders"."total_paise" = "orders"."subtotal_paise" + "orders"."shipping_paise");--> statement-breakpoint
CREATE POLICY "delivery_zones: public read" ON "delivery_zones" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "delivery_zones: admin insert" ON "delivery_zones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "delivery_zones: admin update" ON "delivery_zones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "delivery_zones: admin delete" ON "delivery_zones" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "email_queue: admin read" ON "email_queue" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "order_events: admin read" ON "order_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "order_items: admin read" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "settings: public read" ON "settings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "settings: admin update" ON "settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));