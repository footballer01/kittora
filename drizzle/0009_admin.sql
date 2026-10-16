ALTER TYPE "public"."email_kind" ADD VALUE 'packed';--> statement-breakpoint
ALTER TYPE "public"."email_kind" ADD VALUE 'delivered';--> statement-breakpoint
ALTER TYPE "public"."email_kind" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "cod_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_note" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "x_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "shipping_policy" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "returns_policy" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "terms_text" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "privacy_text" text;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
DROP POLICY "orders: admin update" ON "orders" CASCADE;--> statement-breakpoint
CREATE POLICY "admin_audit_log: admin read" ON "admin_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));