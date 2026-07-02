-- ─────────────────────────────────────────────────────────────────────────────
-- Service Locations: up to 10 cities/towns a vendor serves.
-- Powers the public "Service Area" list and LocalBusiness areaServed schema (SEO).
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.vendors
  add column if not exists service_locations text[] not null default '{}';
