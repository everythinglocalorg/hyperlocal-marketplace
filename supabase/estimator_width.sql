-- ─────────────────────────────────────────────────────────────────────────────
-- Linear-foot width → square-foot conversion for trim-style work.
-- A width (inches) on a linear-foot substrate/product converts linear feet to
-- square feet (LF × inches / 12) so a sq-ft production rate + coverage apply.
--
-- Run after estimator_config.sql. Idempotent.
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.estimate_substrates
  add column if not exists width_inches numeric;

alter table public.estimate_catalog_items
  add column if not exists width_inches numeric;
