-- ============================================================
-- Fix: allow the "Apply Now" CTA.
-- cta.ts offers cta_type 'apply' (Apply Now → opens listings.cta_url), but
-- listings_cta_type_check didn't include it — so choosing "Apply Now" and
-- saving failed the CHECK constraint and reverted to the previous CTA.
-- Run in: Supabase Dashboard → SQL Editor → New Query. Idempotent.
-- ============================================================
alter table public.listings drop constraint if exists listings_cta_type_check;
alter table public.listings add constraint listings_cta_type_check
  check (cta_type is null or cta_type = any (array[
    'book','estimate','call','menu','buy','rent','order','apply'
  ]));
