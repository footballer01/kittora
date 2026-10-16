-- Guest checkout, UPI payment and order tracking.
--
-- The public can never read or write order tables. These SECURITY DEFINER
-- functions are the only ways in:
--   place_order()     service_role only: called by the place-order Edge Function
--                     after it verifies Cloudflare Turnstile. Re-prices from the
--                     database, reserves stock, caps quantities and unpaid orders.
--   track_order()     anon: order number + phone, rate-limited.
--   submit_payment()  anon: UTR (+ optional screenshot) for an unpaid order.
-- Every function runs with an empty search_path and validates its own input.

-- One settings row, empty/0 by default (the storefront hides empty fields).
-- The WhatsApp number defaults to the store's published contact number.
INSERT INTO public.settings (id, whatsapp_number) VALUES (true, '9764795606') ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- Grants: RLS decides rows, but only on tables a role may touch at all.
REVOKE ALL ON public.orders, public.order_items, public.order_events, public.settings, public.delivery_zones, public.email_queue, public.rate_limits FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.settings, public.delivery_zones TO anon, authenticated;--> statement-breakpoint
GRANT UPDATE ON public.settings TO authenticated;--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;--> statement-breakpoint
GRANT SELECT, UPDATE ON public.orders TO authenticated;--> statement-breakpoint
GRANT SELECT ON public.order_items, public.order_events, public.email_queue TO authenticated;--> statement-breakpoint

DROP TRIGGER IF EXISTS touch_updated_at ON public.settings;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.delivery_zones;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON public.email_queue;--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.email_queue FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Helpers (not callable by the public)
-- ---------------------------------------------------------------------------

-- Caller IP as seen by Supabase's API gateway (PostgREST exposes request
-- headers). cf-connecting-ip is set by Cloudflare and cannot be forged.
CREATE OR REPLACE FUNCTION public.client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  h jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
BEGIN
  RETURN coalesce(
    nullif(h->>'cf-connecting-ip', ''),
    nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
EXCEPTION WHEN others THEN
  RETURN 'unknown';
END;
$$;--> statement-breakpoint

-- Fixed-window rate limit. Returns false once `p_limit` hits are used up.
CREATE OR REPLACE FUNCTION public.rate_limit(p_key text, p_limit int, p_window interval)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01');
  n int;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, hits) VALUES (p_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO n;
  RETURN n <= p_limit;
END;
$$;--> statement-breakpoint

-- Indian mobile number as 10 digits, or null. Accepts +91 / 0 prefixes and spaces.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
BEGIN
  IF length(d) = 12 AND left(d, 2) = '91' THEN d := substr(d, 3);
  ELSIF length(d) = 11 AND left(d, 1) = '0' THEN d := substr(d, 2);
  END IF;
  RETURN CASE WHEN d ~ '^[6-9][0-9]{9}$' THEN d END;
END;
$$;--> statement-breakpoint

-- Random order number: "KT" + 10 characters from a 32-symbol alphabet with no
-- look-alikes (50 random bits). Not sequential, so it reveals no sales volume.
CREATE OR REPLACE FUNCTION public.new_order_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea;
  n text;
BEGIN
  LOOP
    bytes := uuid_send(gen_random_uuid());
    n := 'KT';
    -- Skip bytes 6 and 8 (uuid version/variant bits).
    FOR i IN 0..15 LOOP
      CONTINUE WHEN i = 6 OR i = 8;
      n := n || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    END LOOP;
    n := left(n, 12);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE number = n);
  END LOOP;
  RETURN n;
END;
$$;--> statement-breakpoint

-- What a customer may see of their own order.
CREATE OR REPLACE FUNCTION public.order_public(o public.orders)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'number', o.number,
    'status', o.status,
    'name', o.name,
    'city', o.city,
    'state', o.state,
    'pincode', o.pincode,
    'subtotal_paise', o.subtotal_paise,
    'shipping_paise', o.shipping_paise,
    'total_paise', o.total_paise,
    'utr_submitted', o.utr IS NOT NULL,
    'created_at', o.created_at,
    'expires_at', o.expires_at,
    -- The upload folder is useful only while payment is awaited.
    'upload_key', CASE WHEN o.status = 'awaiting_payment' THEN o.upload_key END,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object('slug', i.slug, 'name', i.name, 'size', i.size, 'qty', i.qty, 'unit_price_paise', i.unit_price_paise) ORDER BY i.name, i.size)
      FROM public.order_items i WHERE i.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) ORDER BY e.created_at, e.id)
      FROM public.order_events e WHERE e.order_id = o.id
    ), '[]'::jsonb)
  );
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- place_order
-- ---------------------------------------------------------------------------
-- p_customer: {name, phone, email?, address, city, state, pincode}
-- p_items:    [{slug, size, qty}]   (no prices: the database sets them)
-- p_ip:       client IP, passed by the Edge Function (service role only)
-- Errors are raised with a short code as the message (see lib/checkout/api.ts).
CREATE OR REPLACE FUNCTION public.place_order(p_customer jsonb, p_items jsonb, p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  max_qty constant int := 5;
  max_lines constant int := 20;
  max_unpaid_per_phone constant int := 2;
  max_unpaid_per_ip constant int := 4;
  v_name text := btrim(p_customer->>'name');
  v_phone text := public.normalize_phone(p_customer->>'phone');
  v_email text := nullif(lower(btrim(p_customer->>'email')), '');
  v_address text := btrim(p_customer->>'address');
  v_city text := btrim(p_customer->>'city');
  v_state text := btrim(p_customer->>'state');
  v_pincode text := btrim(p_customer->>'pincode');
  v_ip_hash text := md5(coalesce(nullif(p_ip, ''), 'unknown'));
  s public.settings;
  line record;
  v record;
  v_subtotal int := 0;
  v_shipping int := 0;
  v_order public.orders;
BEGIN
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF v_phone IS NULL THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF v_address IS NULL OR length(v_address) NOT BETWEEN 5 AND 300 THEN RAISE EXCEPTION 'invalid_address'; END IF;
  IF v_city IS NULL OR length(v_city) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_city'; END IF;
  IF v_state IS NULL OR length(v_state) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF v_pincode IS NULL OR v_pincode !~ '^[1-9][0-9]{5}$' THEN RAISE EXCEPTION 'invalid_pincode'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND max_lines THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF NOT public.rate_limit('place:' || v_ip_hash, 10, interval '1 hour') THEN RAISE EXCEPTION 'rate_limited'; END IF;
  IF (SELECT count(*) FROM public.orders WHERE phone = v_phone AND status = 'awaiting_payment') >= max_unpaid_per_phone
     OR (SELECT count(*) FROM public.orders WHERE ip_hash = v_ip_hash AND status = 'awaiting_payment') >= max_unpaid_per_ip THEN
    RAISE EXCEPTION 'too_many_unpaid';
  END IF;

  SELECT * INTO s FROM public.settings WHERE id;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) x
    WHERE jsonb_typeof(x) <> 'object' OR jsonb_typeof(x->'slug') <> 'string' OR jsonb_typeof(x->'size') <> 'string'
       OR jsonb_typeof(x->'qty') <> 'number' OR (x->>'qty') !~ '^[0-9]{1,3}$'
  ) THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) x
    GROUP BY btrim(x->>'slug'), btrim(x->>'size')
    HAVING sum((x->>'qty')::int) NOT BETWEEN 1 AND max_qty
  ) THEN
    RAISE EXCEPTION 'quantity_limit';
  END IF;

  INSERT INTO public.orders (number, name, phone, email, address, city, state, pincode, subtotal_paise, shipping_paise, total_paise, ip_hash, expires_at)
  VALUES (public.new_order_number(), v_name, v_phone, v_email, v_address, v_city, v_state, v_pincode, 0, 0, 0, v_ip_hash,
          CASE WHEN s.unpaid_timeout_minutes > 0 THEN now() + make_interval(mins => s.unpaid_timeout_minutes) END)
  RETURNING * INTO v_order;

  -- Lock variants in a fixed order so concurrent orders cannot deadlock.
  FOR line IN
    SELECT btrim(x->>'slug') AS slug, btrim(x->>'size') AS size, sum((x->>'qty')::int)::int AS qty
    FROM jsonb_array_elements(p_items) x
    GROUP BY 1, 2
    ORDER BY 1, 2
  LOOP
    SELECT var.id AS variant_id, var.stock, p.id AS product_id, p.name, p.price_paise, p.track_stock
      INTO v
      FROM public.variants var JOIN public.products p ON p.id = var.product_id
      WHERE p.slug = line.slug AND var.size = line.size AND p.published
      FOR UPDATE OF var;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unavailable' USING DETAIL = line.slug || ':' || line.size;
    END IF;
    IF v.track_stock THEN
      IF coalesce(v.stock, 0) < line.qty THEN
        RAISE EXCEPTION 'out_of_stock' USING DETAIL = line.slug || ':' || line.size || ':' || coalesce(v.stock, 0);
      END IF;
      UPDATE public.variants SET stock = coalesce(stock, 0) - line.qty WHERE id = v.variant_id;
    END IF;
    INSERT INTO public.order_items (order_id, product_id, variant_id, slug, name, size, qty, unit_price_paise, reserved)
    VALUES (v_order.id, v.product_id, v.variant_id, line.slug, v.name, line.size, line.qty, v.price_paise, v.track_stock);
    v_subtotal := v_subtotal + v.price_paise * line.qty;
  END LOOP;

  v_shipping := CASE
    WHEN s.free_shipping_threshold_paise > 0 AND v_subtotal >= s.free_shipping_threshold_paise THEN 0
    ELSE coalesce(s.shipping_fee_paise, 0)
  END;
  UPDATE public.orders
    SET subtotal_paise = v_subtotal, shipping_paise = v_shipping, total_paise = v_subtotal + v_shipping
    WHERE id = v_order.id
    RETURNING * INTO v_order;

  -- The order-placed email is queued here, once the items and total exist.
  IF v_order.email IS NOT NULL THEN
    INSERT INTO public.email_queue (order_id, kind, to_email, payload)
    VALUES (v_order.id, 'order_placed', v_order.email, public.order_public(v_order));
  END IF;

  RETURN public.order_public(v_order);
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- track_order / submit_payment (anon)
-- ---------------------------------------------------------------------------

-- Same answer (null) for "no such order" and "wrong phone", so neither leaks.
-- Limits: 20 lookups per 10 min per IP, 10 per hour per order number.
CREATE OR REPLACE FUNCTION public.track_order(p_number text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number text := upper(regexp_replace(coalesce(p_number, ''), '[^A-Za-z0-9]', '', 'g'));
  o public.orders;
BEGIN
  IF NOT public.rate_limit('track-ip:' || md5(public.client_ip()), 20, interval '10 minutes')
     OR NOT public.rate_limit('track-no:' || v_number, 10, interval '1 hour') THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  SELECT * INTO o FROM public.orders WHERE number = v_number AND phone = public.normalize_phone(p_phone);
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.order_public(o);
END;
$$;--> statement-breakpoint

-- Records the customer's UPI reference (UTR) and optional screenshot, and moves
-- the order to "payment submitted" for an admin to verify. Failures after the
-- rate limit return {"error": code} instead of raising, so the hit is counted
-- (a raise would roll it back and allow unlimited phone guesses).
CREATE OR REPLACE FUNCTION public.submit_payment(p_number text, p_phone text, p_utr text, p_proof_path text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number text := upper(regexp_replace(coalesce(p_number, ''), '[^A-Za-z0-9]', '', 'g'));
  v_utr text := upper(regexp_replace(coalesce(p_utr, ''), '\s', '', 'g'));
  v_proof text := nullif(btrim(p_proof_path), '');
  o public.orders;
BEGIN
  IF NOT public.rate_limit('pay-ip:' || md5(public.client_ip()), 10, interval '10 minutes')
     OR NOT public.rate_limit('pay-no:' || v_number, 5, interval '1 hour') THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF v_utr !~ '^[A-Z0-9]{6,35}$' THEN RETURN jsonb_build_object('error', 'invalid_utr'); END IF;
  SELECT * INTO o FROM public.orders WHERE number = v_number AND phone = public.normalize_phone(p_phone) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF o.status <> 'awaiting_payment' OR (o.expires_at IS NOT NULL AND o.expires_at <= now()) THEN
    RETURN jsonb_build_object('error', 'not_awaiting_payment');
  END IF;
  IF v_proof IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-proofs' AND name = v_proof AND split_part(name, '/', 1) = o.upload_key::text
  ) THEN
    RETURN jsonb_build_object('error', 'invalid_proof');
  END IF;
  UPDATE public.orders SET status = 'payment_submitted', utr = v_utr, payment_proof_path = v_proof WHERE id = o.id RETURNING * INTO o;
  RETURN public.order_public(o);
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Status changes: timeline, stock release, email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind public.email_kind;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.order_events (order_id, status) VALUES (NEW.id, NEW.status);

  -- Cancelling returns reserved stock (tracked products only), exactly once.
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' THEN
    UPDATE public.variants v SET stock = coalesce(v.stock, 0) + i.qty
      FROM public.order_items i
      WHERE i.order_id = NEW.id AND i.reserved AND v.id = i.variant_id;
    UPDATE public.order_items SET reserved = false WHERE order_id = NEW.id AND reserved;
  END IF;

  v_kind := CASE NEW.status WHEN 'paid' THEN 'payment_confirmed' WHEN 'shipped' THEN 'shipped' END;
  IF TG_OP = 'UPDATE' AND v_kind IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.email_queue (order_id, kind, to_email, payload)
    VALUES (NEW.id, v_kind, NEW.email, public.order_public(NEW))
    ON CONFLICT (order_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS on_order_status ON public.orders;--> statement-breakpoint
CREATE TRIGGER on_order_status AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status();--> statement-breakpoint

-- Auto-cancel unpaid orders past their timeout (stock is released by the
-- trigger above) and drop old rate-limit windows. Run by pg_cron every 10
-- minutes when available, and daily by the keepalive workflow as a backup.
CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.orders SET status = 'cancelled'
    WHERE status = 'awaiting_payment' AND expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  RETURN n;
END;
$$;--> statement-breakpoint

-- Admin: set every size of a product to the same stock count (stock tracking on).
CREATE OR REPLACE FUNCTION public.admin_set_stock(p_product uuid, p_stock int)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_stock IS NULL OR p_stock < 0 THEN RAISE EXCEPTION 'invalid_stock'; END IF;
  UPDATE public.variants SET stock = p_stock WHERE product_id = p_product;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;--> statement-breakpoint

-- New functions are executable by PUBLIC by default (and Supabase also grants
-- anon/authenticated). Revoke everything, then grant exactly what's intended.
REVOKE ALL ON FUNCTION public.client_ip(), public.rate_limit(text, int, interval), public.normalize_phone(text), public.new_order_number(),
  public.order_public(public.orders), public.place_order(jsonb, jsonb, text), public.track_order(text, text),
  public.submit_payment(text, text, text, text), public.on_order_status(), public.cancel_expired_orders(), public.admin_set_stock(uuid, int)
  FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text), public.cancel_expired_orders() TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.track_order(text, text), public.submit_payment(text, text, text, text) TO anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_set_stock(uuid, int) TO authenticated;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private bucket for payment screenshots: images only, 5 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint

-- Public bucket for the payment QR image and other store assets. Admin writes only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-assets', 'site-assets', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint

-- A guest may upload into <upload_key>/ only while that order awaits payment,
-- at most 3 files. The upload key is returned only to whoever placed the order.
CREATE OR REPLACE FUNCTION public.can_upload_payment_proof(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k text := split_part(coalesce(p_name, ''), '/', 1);
BEGIN
  IF k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_name !~ '^[^/]+/[A-Za-z0-9._-]{1,80}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE upload_key = k::uuid AND status = 'awaiting_payment' AND (expires_at IS NULL OR expires_at > now())
  ) AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'payment-proofs' AND name LIKE k || '/%') < 3;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.can_upload_payment_proof(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.can_upload_payment_proof(text) TO anon, authenticated;--> statement-breakpoint

DROP POLICY IF EXISTS "payment-proofs: guest upload" ON storage.objects;--> statement-breakpoint
CREATE POLICY "payment-proofs: guest upload" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (SELECT public.can_upload_payment_proof(name)));--> statement-breakpoint
DROP POLICY IF EXISTS "payment-proofs: admin read" ON storage.objects;--> statement-breakpoint
CREATE POLICY "payment-proofs: admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (SELECT public.is_admin()));--> statement-breakpoint
DROP POLICY IF EXISTS "payment-proofs: admin delete" ON storage.objects;--> statement-breakpoint
CREATE POLICY "payment-proofs: admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (SELECT public.is_admin()));--> statement-breakpoint
DROP POLICY IF EXISTS "site-assets: admin all" ON storage.objects;--> statement-breakpoint
CREATE POLICY "site-assets: admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'site-assets' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'site-assets' AND (SELECT public.is_admin()));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Schedule (pg_cron is available on Supabase's free plan; skipped elsewhere)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    PERFORM cron.schedule('kittora-cancel-unpaid', '*/10 * * * *', 'select public.cancel_expired_orders()');
  END IF;
END;
$$;
--> statement-breakpoint

-- The send-email Edge Function claims a batch atomically (SKIP LOCKED), so
-- overlapping runs never send the same email twice.
CREATE OR REPLACE FUNCTION public.claim_emails(p_limit int DEFAULT 20)
RETURNS SETOF public.email_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.email_queue
    SET attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes'
    WHERE id IN (
      SELECT id FROM public.email_queue
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT least(greatest(p_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.claim_emails(int) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.claim_emails(int) TO service_role;
