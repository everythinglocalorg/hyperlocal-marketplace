-- ============================================================
-- LISTING ANALYTICS — atomic view/click counters.
-- SECURITY DEFINER so anonymous visitors can increment them
-- (the functions only bump counters; they expose no data).
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create or replace function public.increment_vendor_listing_views(vendor_id_in uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
     set view_count = coalesce(view_count, 0) + 1
   where vendor_id = vendor_id_in and is_active = true;
$$;

create or replace function public.increment_listing_clicks(listing_id_in uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
     set click_count = coalesce(click_count, 0) + 1
   where id = listing_id_in;
$$;

grant execute on function public.increment_vendor_listing_views(uuid) to anon, authenticated;
grant execute on function public.increment_listing_clicks(uuid) to anon, authenticated;

-- Vendor-level store-page visits (distinct from per-listing views).
alter table public.vendors add column if not exists profile_views integer default 0;

create or replace function public.increment_vendor_profile_views(vendor_id_in uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.vendors
     set profile_views = coalesce(profile_views, 0) + 1
   where id = vendor_id_in;
$$;

grant execute on function public.increment_vendor_profile_views(uuid) to anon, authenticated;
