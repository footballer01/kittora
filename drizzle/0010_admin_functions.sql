-- Admin panel: two-factor-aware admin check, audit log, enforced order status
-- flow, dashboard numbers, image ordering and the admin-login helpers.

-- ---------------------------------------------------------------------------
-- is_admin(): an admin who has turned on two-factor (TOTP) counts as admin only
-- in a session that passed the second factor (aal2). Every RLS policy and admin
-- function goes through this, so a stolen password alone is not enough.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) AND (
    coalesce((SELECT auth.jwt()) ->> 'aal', '') = 'aal2'
    OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = (SELECT auth.uid()) AND f.status = 'verified')
  );
END;
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Audit log: every write made by a signed-in user (only admins pass RLS) is
-- recorded by trigger, so it can't be skipped from the browser. Checkout
-- functions and scheduled jobs run without a user and aren't logged.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.admin_audit_log TO authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.audit_admin_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  old_row jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  r jsonb := coalesce(new_row, old_row);
  changes jsonb;
BEGIN
  IF actor IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, n.value) INTO changes
      FROM jsonb_each(new_row) n
      WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM old_row -> n.key;
    IF changes IS NULL THEN RETURN NULL; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    changes := new_row - 'created_at' - 'updated_at';
  ELSE
    changes := jsonb_strip_nulls(jsonb_build_object('name', old_row ->> 'name', 'slug', old_row ->> 'slug', 'title', old_row ->> 'title',
      'size', old_row ->> 'size', 'storage_path', old_row ->> 'storage_path', 'pincode_prefix', old_row ->> 'pincode_prefix'));
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (actor, lower(TG_OP), TG_TABLE_NAME, coalesce(r ->> 'id', concat_ws(':', r ->> 'edit_id', r ->> 'product_id')), changes);
  RETURN NULL;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_admin_write() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'product_images', 'variants', 'edits', 'edit_items', 'orders', 'settings', 'delivery_zones'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_admin_write ON public.%I', t);
    EXECUTE format('CREATE TRIGGER audit_admin_write AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_admin_write()', t);
  END LOOP;
END;
$$;--> statement-breakpoint

-- Service role only: entries with no table row behind them (sign-ins, publish).
CREATE OR REPLACE FUNCTION public.admin_log(p_actor uuid, p_action text, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.admin_audit_log (actor_id, action, details) VALUES (p_actor, left(p_action, 40), p_details);
$$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Orders: the status flow is enforced for everyone (admins included), and
-- admins change orders only through admin_set_order_status().
--   awaiting_payment  → payment_submitted, paid, cancelled
--   payment_submitted → paid, cancelled
--   paid              → packed, shipped, cancelled
--   packed            → shipped, cancelled
--   shipped           → delivered
--   delivered, cancelled: final (cancelling already returned the stock)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_transition_ok(p_from public.order_status, p_to public.order_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_from
    WHEN 'awaiting_payment' THEN p_to IN ('payment_submitted', 'paid', 'cancelled')
    WHEN 'payment_submitted' THEN p_to IN ('paid', 'cancelled')
    WHEN 'paid' THEN p_to IN ('packed', 'shipped', 'cancelled')
    WHEN 'packed' THEN p_to IN ('shipped', 'cancelled')
    WHEN 'shipped' THEN p_to = 'delivered'
    ELSE false
  END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.check_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.order_transition_ok(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'invalid_transition' USING DETAIL = OLD.status || ' -> ' || NEW.status;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS check_order_transition ON public.orders;--> statement-breakpoint
CREATE TRIGGER check_order_transition BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.check_order_transition();--> statement-breakpoint

-- Orders are no longer directly updatable from the browser, even by admins
-- (totals, items and payment details can't be edited).
REVOKE UPDATE ON public.orders FROM authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_order uuid, p_status public.order_status, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  o public.orders;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(v_note) > 500 THEN RAISE EXCEPTION 'invalid_note'; END IF;
  UPDATE public.orders
    SET status = p_status,
        tracking_note = CASE WHEN p_status IN ('shipped', 'delivered') THEN coalesce(v_note, tracking_note) ELSE tracking_note END
    WHERE id = p_order
    RETURNING * INTO o;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object('id', o.id, 'status', o.status, 'tracking_note', o.tracking_note);
END;
$$;--> statement-breakpoint

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
    'tracking_note', CASE WHEN o.status IN ('shipped', 'delivered') THEN o.tracking_note END,
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

  -- Every status the customer cares about sends one email (once per kind).
  v_kind := CASE NEW.status
    WHEN 'paid' THEN 'payment_confirmed' WHEN 'packed' THEN 'packed' WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' END;
  IF TG_OP = 'UPDATE' AND v_kind IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.email_queue (order_id, kind, to_email, payload)
    VALUES (NEW.id, v_kind, NEW.email, public.order_public(NEW))
    ON CONFLICT (order_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

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
  v_reserved boolean := false;
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
      v_reserved := true;
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
    SET subtotal_paise = v_subtotal, shipping_paise = v_shipping, total_paise = v_subtotal + v_shipping,
        -- Reserved stock must always come back: with no timeout set in Settings,
        -- an unpaid order that holds stock still expires after 48 hours.
        expires_at = coalesce(expires_at, CASE WHEN v_reserved THEN now() + interval '48 hours' END)
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
-- Admin helpers
-- ---------------------------------------------------------------------------

-- Dashboard numbers in one call ("today" and "this week" in India time; the
-- week starts on Monday). Storage is compared with the free plan's 1 GB.
CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_now timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  today timestamptz := date_trunc('day', local_now) AT TIME ZONE 'Asia/Kolkata';
  week timestamptz := date_trunc('week', local_now) AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'orders_today', (SELECT count(*) FROM public.orders WHERE created_at >= today),
    'revenue_week_paise', (SELECT coalesce(sum(total_paise), 0) FROM public.orders
                            WHERE created_at >= week AND status IN ('paid', 'packed', 'shipped', 'delivered')),
    'payments_to_verify', (SELECT count(*) FROM public.orders WHERE status = 'payment_submitted'),
    'to_pack', (SELECT count(*) FROM public.orders WHERE status IN ('paid', 'packed')),
    'low_stock', (SELECT coalesce(jsonb_agg(x ORDER BY x.stock, x.name, x.size), '[]'::jsonb) FROM (
                    SELECT p.id, p.name, v.size, coalesce(v.stock, 0) AS stock
                    FROM public.variants v JOIN public.products p ON p.id = v.product_id
                    WHERE p.track_stock AND coalesce(v.stock, 0) <= 2
                    ORDER BY coalesce(v.stock, 0), p.name, v.size LIMIT 20) x),
    'storage_bytes', (SELECT coalesce(sum((metadata ->> 'size')::bigint), 0) FROM storage.objects),
    'storage_limit_bytes', 1073741824,
    'email', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) FROM (
                SELECT status, count(*) AS n FROM public.email_queue GROUP BY status) e)
  );
END;
$$;--> statement-breakpoint

-- Reorder a product's images: p_ids lists every image of the product, in order.
CREATE OR REPLACE FUNCTION public.admin_reorder_images(p_product uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(cardinality(p_ids), 0) <> (SELECT count(*) FROM public.product_images WHERE product_id = p_product)
     OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x) <> cardinality(p_ids)
     OR EXISTS (SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS (SELECT 1 FROM public.product_images i WHERE i.id = x AND i.product_id = p_product)) THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  -- Move out of the way first: (product_id, position) is unique.
  UPDATE public.product_images SET position = -1 - position WHERE product_id = p_product;
  UPDATE public.product_images i SET position = x.ord - 1
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
    WHERE i.id = x.id;
END;
$$;--> statement-breakpoint

-- Admin login, step 1 (admin-login Edge Function, service role): count the
-- attempt (5 per 15 min per IP + username, 20 per 15 min per IP) and return
-- the account's sign-in email. Admin emails are random, so the public Auth
-- endpoint can't be used to skip these limits.
CREATE OR REPLACE FUNCTION public.admin_login_begin(p_username text, p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u text := lower(btrim(coalesce(p_username, '')));
  ip text := md5(coalesce(nullif(p_ip, ''), 'unknown'));
BEGIN
  IF NOT public.rate_limit('login:' || ip || ':' || md5(u), 5, interval '15 minutes')
     OR NOT public.rate_limit('login-ip:' || ip, 20, interval '15 minutes') THEN
    PERFORM public.admin_log(NULL, 'login_blocked', jsonb_build_object('username', left(u, 40), 'ip', left(ip, 12)));
    RETURN jsonb_build_object('allowed', false);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'email', (
    SELECT au.email FROM public.profiles p JOIN auth.users au ON au.id = p.id
    WHERE lower(p.username) = u AND p.role = 'admin'
  ));
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.admin_log(uuid, text, jsonb), public.order_transition_ok(public.order_status, public.order_status),
  public.check_order_transition(), public.admin_set_order_status(uuid, public.order_status, text), public.admin_dashboard(),
  public.admin_reorder_images(uuid, uuid[]), public.admin_login_begin(text, text), public.order_public(public.orders),
  public.on_order_status(), public.place_order(jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, public.order_status, text), public.admin_dashboard(),
  public.admin_reorder_images(uuid, uuid[]) TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_log(uuid, text, jsonb), public.admin_login_begin(text, text), public.place_order(jsonb, jsonb, text) TO service_role;
