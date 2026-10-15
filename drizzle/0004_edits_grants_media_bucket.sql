-- Grants and triggers for edits, plus the product-media bucket (detail videos
-- and posters). Media is copied to the static site at publish time, so the
-- public never downloads from Supabase Storage.

REVOKE ALL ON public.edits, public.edit_items FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.edits, public.edit_items TO anon, authenticated;--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.edits, public.edit_items TO authenticated;--> statement-breakpoint

DROP TRIGGER IF EXISTS touch_updated_at ON public.edits;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.edits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-media', 'product-media', false, 2097152, ARRAY['video/mp4', 'video/webm', 'image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint

DROP POLICY IF EXISTS "product-media: admin all" ON storage.objects;--> statement-breakpoint
CREATE POLICY "product-media: admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-media' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'product-media' AND (SELECT public.is_admin()));
