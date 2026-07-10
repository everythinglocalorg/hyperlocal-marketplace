-- ─────────────────────────────────────────────────────────────────────────────
-- Estimator config — trade-agnostic substrates + per-vendor settings.
--
--   • estimate_substrates — a named work type (Trim, Walls, Concrete, Lawn…) with
--     a calculation type and a PRODUCTION RATE = how many units can be completed
--     in one hour (e.g. 200 sq ft/hr). Labor time is derived from this, so it
--     works for painters, builders, concrete, lawncare, etc. No "coats".
--   • estimate_settings — one row per vendor holding estimating defaults.
--
-- Run after proposals.sql / estimator_tools.sql. Idempotent.
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Substrates (a.k.a. categories) ───────────────────────────────────────────
create table if not exists public.estimate_substrates (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors(id) on delete cascade,
  name            text not null,                     -- Trim / Walls / Concrete / Lawn
  calc_type       text not null default 'sqft'
                    check (calc_type in ('sqft','linear_ft','each','hour')),
  production_rate numeric not null default 0,        -- units completed per hour (0 = set on the line)
  labor_rate      numeric not null default 0,        -- $ per hour
  is_active       boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists estimate_substrates_vendor_idx on public.estimate_substrates (vendor_id);
alter table public.estimate_substrates enable row level security;
drop policy if exists "Vendors manage own substrates" on public.estimate_substrates;
create policy "Vendors manage own substrates" on public.estimate_substrates
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ── Per-vendor estimating settings ───────────────────────────────────────────
create table if not exists public.estimate_settings (
  vendor_id           uuid primary key references public.vendors(id) on delete cascade,
  default_labor_rate  numeric not null default 0,    -- $ per hour
  default_markup_pct  numeric not null default 0,    -- % on material + labor
  tax_rate_pct        numeric not null default 0,    -- % sales tax
  min_job_price       numeric not null default 0,    -- floor for a proposal total
  default_deposit_pct numeric not null default 50,   -- default deposit % on new proposals
  updated_at          timestamptz default now()
);
alter table public.estimate_settings enable row level security;
drop policy if exists "Vendors manage own estimate settings" on public.estimate_settings;
create policy "Vendors manage own estimate settings" on public.estimate_settings
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ── Price-book items: link to a substrate + production rate (generalizes away
--    from paint "coats"). ──────────────────────────────────────────────────────
alter table public.estimate_catalog_items
  add column if not exists substrate_id    uuid references public.estimate_substrates(id) on delete set null,
  add column if not exists production_rate numeric;  -- units/hour for labor (overrides substrate when set)
