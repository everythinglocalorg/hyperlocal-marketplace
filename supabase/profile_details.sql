-- ============================================================
-- PROFILE DETAILS — optional, toggleable "about me" boxes shown
-- on a user's Local Profile (/u/[id]): positions/roles, achievements,
-- and their ask for the community. "Businesses owned" is derived
-- live from the vendors table (vendors.user_id), not stored here.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
alter table public.profiles
  add column if not exists profile_details jsonb default '{}'::jsonb;
