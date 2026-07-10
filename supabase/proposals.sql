-- ─────────────────────────────────────────────────────────────────────────────
-- Proposals / DripJobs-style estimate builder
--
-- Phase 1 data model:
--   • estimate_catalog_items  — per-vendor "price book" (substrates, products,
--     spread rates, COGS, labor, markup) used to auto-calculate line totals.
--   • estimates (extended)    — area-based builder structure stored as jsonb
--     (areas + addons), deposit terms, payment methods, plus a public share
--     token / accepted_at / expires_at reserved for the Phase 2 customer view.
--   • estimate_media          — photos (CompanyCam / uploads) + video URLs
--     attached to a proposal. Table created now; UI wired in Phase 2.
--
-- The existing `estimates.line_items` jsonb is kept in sync as a FLAT list by the
-- builder, so the current email/print/list code keeps working unchanged.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Price book: per-vendor catalog items ─────────────────────────────────────
create table if not exists public.estimate_catalog_items (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors(id) on delete cascade,
  substrate     text not null default 'General',      -- wood / concrete / drywall / gravel …
  name          text not null,                         -- "Loxon XP Masonry Coat"
  unit_basis    text not null default 'sqft'
                  check (unit_basis in ('sqft','linear_ft','each','hour')),
  spread_rate   numeric,                               -- coverage per unit of material (e.g. sqft/gal); null/0 = not coverage-based
  cost_of_goods numeric not null default 0,            -- material $ per unit of material (per gal / per each / per hour)
  labor_rate    numeric not null default 0,            -- labor $ per measurement unit
  markup_pct    numeric not null default 0,            -- % markup on (material + labor)
  default_coats integer not null default 1,
  product_line  text,                                  -- brand/line e.g. "Sherwin Williams"
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists estimate_catalog_items_vendor_idx
  on public.estimate_catalog_items (vendor_id, substrate);

alter table public.estimate_catalog_items enable row level security;

drop policy if exists "Vendors manage own catalog items" on public.estimate_catalog_items;
create policy "Vendors manage own catalog items" on public.estimate_catalog_items
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ── Estimates: builder structure + deposit + payment + share ─────────────────
alter table public.estimates
  add column if not exists areas           jsonb   default '[]',   -- Area[] (see src/lib/estimate-pricing.ts)
  add column if not exists addons          jsonb   default '[]',   -- Addon[]
  add column if not exists deposit_type    text    default 'percent',  -- 'percent' | 'flat'
  add column if not exists deposit_value   numeric default 50,     -- 50 (%) or a flat $ amount
  add column if not exists payment_methods text[]  default '{card}',   -- allowed: 'card','check'
  add column if not exists project_overview text,                  -- rich markdown block
  add column if not exists salesperson     text,
  add column if not exists proposal_number text,
  add column if not exists share_token     text,                   -- public /proposal/[token]
  add column if not exists accepted_at     timestamptz,
  add column if not exists expires_at      timestamptz,
  add column if not exists customer_selections   jsonb,            -- {optional_area_ids:[], addon_ids:[]} chosen by customer
  add column if not exists accepted_payment_method text,           -- 'card' | 'check'
  add column if not exists deposit_paid_at        timestamptz,
  add column if not exists deposit_payment_intent text;

create unique index if not exists estimates_share_token_key
  on public.estimates (share_token) where share_token is not null;

-- ── Media: photos (CompanyCam / uploads) + videos on a proposal ──────────────
create table if not exists public.estimate_media (
  id          uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  area_id     text,                                    -- optional: the builder area this belongs to
  kind        text not null default 'photo'
                check (kind in ('photo','video')),
  source      text not null default 'upload'
                check (source in ('upload','companycam','youtube','vimeo','loom','url')),
  url         text not null,
  thumb_url   text,
  caption     text,
  position    integer not null default 0,
  created_at  timestamptz default now()
);

create index if not exists estimate_media_estimate_idx
  on public.estimate_media (estimate_id, position);

alter table public.estimate_media enable row level security;

drop policy if exists "Vendors manage own estimate media" on public.estimate_media;
create policy "Vendors manage own estimate media" on public.estimate_media
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));
