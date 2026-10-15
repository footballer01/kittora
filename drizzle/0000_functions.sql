-- Helper functions used by RLS policies and triggers. plpgsql bodies are not
-- validated at creation, so these can precede the tables they reference.

-- True when the caller's profile has the admin role. SECURITY DEFINER so RLS
-- policies on profiles don't recurse; empty search_path to avoid hijacking.
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
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;--> statement-breakpoint

-- Every new auth user gets a customer profile. Admin role and username are
-- set by the seed script with the service role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
