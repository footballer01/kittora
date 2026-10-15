CREATE TYPE "public"."image_kind" AS ENUM('front', 'back', 'detail', 'other');--> statement-breakpoint
CREATE TABLE "edit_items" (
	"edit_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "edit_items_edit_id_product_id_pk" PRIMARY KEY("edit_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "edit_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edits_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "edits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "kind" "image_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "story" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "story_title" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "video" jsonb;--> statement-breakpoint
ALTER TABLE "edit_items" ADD CONSTRAINT "edit_items_edit_id_edits_id_fk" FOREIGN KEY ("edit_id") REFERENCES "public"."edits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_items" ADD CONSTRAINT "edit_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_video_limits" CHECK ("products"."video" is null or (("products"."video"->>'bytes')::int <= 2097152 and ("products"."video"->>'durationMs')::int between 5000 and 8000 and "products"."video" ? 'path' and "products"."video" ? 'poster'));--> statement-breakpoint
CREATE POLICY "edit_items: public read" ON "edit_items" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.edits e where e.id = "edit_items"."edit_id" and e.published) and exists (select 1 from public.products p where p.id = "edit_items"."product_id" and p.published));--> statement-breakpoint
CREATE POLICY "edit_items: admin read all" ON "edit_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edit_items: admin insert" ON "edit_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edit_items: admin update" ON "edit_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edit_items: admin delete" ON "edit_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edits: public read published" ON "edits" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("edits"."published");--> statement-breakpoint
CREATE POLICY "edits: admin read all" ON "edits" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edits: admin insert" ON "edits" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edits: admin update" ON "edits" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "edits: admin delete" ON "edits" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));