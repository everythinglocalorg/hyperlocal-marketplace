-- ─────────────────────────────────────────────────────────────────────────────
-- Reusable photo library — vendors save photos (before/after, license, crew,
-- examples) once and attach them to any proposal, like the video library.
--
-- Run after estimator_tools.sql. Idempotent.
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.estimate_photos (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  title      text,
  url        text not null,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists estimate_photos_vendor_idx on public.estimate_photos (vendor_id);
alter table public.estimate_photos enable row level security;
drop policy if exists "Vendors manage own photos" on public.estimate_photos;
create policy "Vendors manage own photos" on public.estimate_photos
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));
