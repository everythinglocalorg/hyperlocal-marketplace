-- ─────────────────────────────────────────────────────────────────────────────
-- Cover reposition: vertical framing (0 = top, 50 = center, 100 = bottom) so
-- vendors can pick which part of their cover photo shows in the banner.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.vendors
  add column if not exists banner_position integer not null default 50;
