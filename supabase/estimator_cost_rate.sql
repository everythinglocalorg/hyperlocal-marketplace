-- ─────────────────────────────────────────────────────────────────────────────
-- Hourly cost rate — what the vendor actually PAYS per hour (vs the billed labor
-- rate). Powers profit calculations in the Job Metrics tab.
--
-- Run after estimator_config.sql. Idempotent.
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.estimate_settings
  add column if not exists hourly_cost_rate numeric not null default 0;
