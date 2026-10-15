-- Triggers, explicit grants and the product image bucket.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

DROP TRIGGER IF EXISTS touch_updated_at ON public.products;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.product_images;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.variants;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.variants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.profiles;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.orders;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint

-- Explicit grants: don't rely on Supabase's default privileges. RLS still
-- decides which rows each role may touch.
REVOKE ALL ON public.products, public.product_images, public.variants, public.profiles, public.orders FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.products, public.product_images, public.variants TO anon, authenticated;--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.products, public.product_images, public.variants TO authenticated;--> statement-breakpoint
GRANT SELECT ON public.profiles TO authenticated;--> statement-breakpoint
GRANT SELECT, UPDATE ON public.orders TO authenticated;--> statement-breakpoint

-- Public-read bucket for compressed product images. Only admins may write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint

DROP POLICY IF EXISTS "product-images: admin select" ON storage.objects;--> statement-breakpoint
CREATE POLICY "product-images: admin select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.is_admin()));--> statement-breakpoint
DROP POLICY IF EXISTS "product-images: admin insert" ON storage.objects;--> statement-breakpoint
CREATE POLICY "product-images: admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (SELECT public.is_admin()));--> statement-breakpoint
DROP POLICY IF EXISTS "product-images: admin update" ON storage.objects;--> statement-breakpoint
CREATE POLICY "product-images: admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'product-images' AND (SELECT public.is_admin()));--> statement-breakpoint
DROP POLICY IF EXISTS "product-images: admin delete" ON storage.objects;--> statement-breakpoint
CREATE POLICY "product-images: admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.is_admin()));
