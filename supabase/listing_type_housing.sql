-- ============================================================
-- Fix: allow Housing listing types.
-- The app's listing Type dropdown offers "Home For Sale" (housing_sale)
-- and "Rental Property" (housing_rent), but listings_type_check never
-- allowed them — so saving/editing a listing as either type failed the
-- CHECK constraint and the whole update was rejected.
-- Run in: Supabase Dashboard → SQL Editor → New Query. Idempotent.
-- ============================================================
alter table public.listings drop constraint if exists listings_type_check;
alter table public.listings add constraint listings_type_check
  check (type = any (array[
    'product','service','restaurant','event','rental','thrift',
    'experience','housing_sale','housing_rent'
  ]));
