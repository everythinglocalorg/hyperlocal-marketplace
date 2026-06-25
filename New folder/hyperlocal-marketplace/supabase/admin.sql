-- Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set super admin
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'dryarrington@gmail.com');

-- Add features JSONB to vendors (replaces tier-only gating)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}';

-- Set all existing Local Pro vendors to have all features on
UPDATE public.vendors
SET features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'
WHERE tier = 'premium';

-- Admin activity log
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text, -- 'vendor', 'user', 'listing'
  target_id text,
  detail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
  ON public.admin_logs FOR SELECT
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Admins can insert logs"
  ON public.admin_logs FOR INSERT
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
