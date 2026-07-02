-- ─────────────────────────────────────────────────────────────────────────────
-- Remove chain / franchise businesses (keep the marketplace locally-owned).
-- Review the name list below BEFORE running — this permanently deletes the
-- matching vendors and all of their listings.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) PREVIEW first — run just this SELECT to see what will be removed:
select id, business_name, city, state
from public.vendors
where business_name ilike any (array[
  '%perkins%',
  '%rocky rococo%',
  '%mcdonald%',
  '%subway%',
  '%culver%',
  '%kwik trip%',
  '%walmart%',
  '%starbucks%',
  '%dairy queen%',
  '%taco bell%',
  '%burger king%',
  '%wendy%',
  '%domino%',
  '%pizza hut%',
  '%applebee%'
]);

-- 2) When the preview looks right, delete listings then the vendors:
with targets as (
  select id from public.vendors
  where business_name ilike any (array[
    '%perkins%',
    '%rocky rococo%',
    '%mcdonald%',
    '%subway%',
    '%culver%',
    '%kwik trip%',
    '%walmart%',
    '%starbucks%',
    '%dairy queen%',
    '%taco bell%',
    '%burger king%',
    '%wendy%',
    '%domino%',
    '%pizza hut%',
    '%applebee%'
  ])
)
delete from public.listings where vendor_id in (select id from targets);

delete from public.vendors
where business_name ilike any (array[
  '%perkins%',
  '%rocky rococo%',
  '%mcdonald%',
  '%subway%',
  '%culver%',
  '%kwik trip%',
  '%walmart%',
  '%starbucks%',
  '%dairy queen%',
  '%taco bell%',
  '%burger king%',
  '%wendy%',
  '%domino%',
  '%pizza hut%',
  '%applebee%'
]);
