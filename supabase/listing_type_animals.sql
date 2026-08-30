-- ============================================================
-- Add the "animals" listing type (pets & livestock for sale/rehoming).
-- The app's listing Type dropdown now offers "Animals / Livestock"
-- (type = 'animals'). Without widening listings_type_check the CHECK
-- constraint rejects the save and the whole insert/update fails silently.
-- Per-animal details (species, breed, age, vet-checked, etc.) ride along
-- as a __animal:{...} JSON entry in listings.tags[] — no new columns.
-- Run in: Supabase Dashboard → SQL Editor → New Query. Idempotent.
-- ============================================================
alter table public.listings drop constraint if exists listings_type_check;
alter table public.listings add constraint listings_type_check
  check (type = any (array[
    'product','service','restaurant','event','rental','thrift',
    'experience','housing_sale','housing_rent','animals'
  ]));
