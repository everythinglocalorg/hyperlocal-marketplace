-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO RUN:
--   Open your Supabase dashboard → SQL Editor → paste this entire file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Make user_id nullable so vendors can exist without an account
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors
  alter column user_id drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Add is_claimed flag (false = placeholder, true = owner has account)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors
  add column if not exists is_claimed boolean not null default true;

-- Back-fill: all existing vendor rows are already claimed (they have accounts)
update public.vendors set is_claimed = true where user_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Update RLS so unclaimed vendors are still publicly visible
-- (The existing "Anyone can view active vendors" policy uses is_active, not
--  user_id, so SELECT already works. These updates tighten UPDATE/INSERT.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow update only when user owns the vendor (user_id may be null on unclaimed)
drop policy if exists "Vendors can update own profile" on public.vendors;
create policy "Vendors can update own profile" on public.vendors
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Claim function (called from /api/claim-vendor, uses service role)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function claim_vendor(p_slug text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_vendor_id uuid;
  v_already_claimed boolean;
  v_claimer_has_vendor boolean;
begin
  select id, is_claimed into v_vendor_id, v_already_claimed
  from public.vendors where slug = p_slug limit 1;

  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'Vendor not found');
  end if;

  if v_already_claimed then
    return jsonb_build_object('ok', false, 'error', 'Already claimed');
  end if;

  -- Check the user doesn't already own a different vendor
  select exists(select 1 from public.vendors where user_id = p_user_id)
  into v_claimer_has_vendor;

  if v_claimer_has_vendor then
    return jsonb_build_object('ok', false, 'error', 'You already have a vendor account');
  end if;

  update public.vendors
  set user_id = p_user_id, is_claimed = true
  where id = v_vendor_id;

  -- Update their profile role to vendor
  update public.profiles set role = 'vendor' where id = p_user_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_vendor_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Insert the 4 pre-loaded Eau Claire businesses (unclaimed)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.vendors (
  user_id, business_name, slug, description, category,
  city, state, zip_code, phone, tier, is_active, is_claimed,
  service_radius_miles, rating, review_count, local_bucks_earned,
  features
) values
(
  null,
  'One Nation Exteriors LLC',
  'one-nation-exteriors-llc',
  'Local roofing, siding, and window experts serving the Eau Claire area. Quality workmanship backed by years of experience.',
  'Services & Trades',
  'Eau Claire', 'WI', '54701',
  '(715) 447-7949',
  'free', true, false,
  50, 0, 0, 0, '{}'
),
(
  null,
  'Red Oak Exteriors',
  'red-oak-exteriors',
  'Full-service exterior contractor specializing in roofing, siding, gutters, and storm restoration in the Chippewa Valley.',
  'Services & Trades',
  'Eau Claire', 'WI', '54701',
  '(715) 400-8010',
  'free', true, false,
  50, 0, 0, 0, '{}'
),
(
  null,
  'Quality Exteriors',
  'quality-exteriors',
  'Expert window, roofing, and exterior services for homeowners in Eau Claire and surrounding communities.',
  'Services & Trades',
  'Eau Claire', 'WI', '54701',
  '(715) 495-5614',
  'free', true, false,
  50, 0, 0, 0, '{}'
),
(
  null,
  '715 Excavating',
  '715-excavating',
  'Professional excavating, retaining wall construction, and land development services in the Eau Claire region.',
  'Services & Trades',
  'Eau Claire', 'WI', '54701',
  '(715) 491-9519',
  'free', true, false,
  50, 0, 0, 0, '{}'
);
