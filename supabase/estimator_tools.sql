-- ─────────────────────────────────────────────────────────────────────────────
-- Estimator Tools — reusable, per-vendor content the proposal builder draws from:
--   • estimate_templates — full proposal skeletons (areas + add-ons + deposit +
--     payment methods + overview/notes). "New Proposal" starts from one.
--   • estimate_snippets   — reusable text blocks: 'snippet' = scope/verbiage that
--     drops into the project overview; 'note' = standard notes/terms.
--   • estimate_videos     — a library of reusable video links attachable to any
--     proposal with one click.
--
-- All vendor-owned (RLS mirrors estimate_catalog_items). Run after proposals.sql.
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Proposal templates ───────────────────────────────────────────────────────
create table if not exists public.estimate_templates (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  name        text not null,
  description text,
  structure   jsonb not null default '{}',   -- {areas, addons, deposit_type, deposit_value, payment_methods, project_overview, notes}
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists estimate_templates_vendor_idx on public.estimate_templates (vendor_id);
alter table public.estimate_templates enable row level security;
drop policy if exists "Vendors manage own templates" on public.estimate_templates;
create policy "Vendors manage own templates" on public.estimate_templates
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ── Text / word snippets ─────────────────────────────────────────────────────
create table if not exists public.estimate_snippets (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  kind       text not null default 'snippet' check (kind in ('snippet','note')),
  title      text not null,
  body       text not null default '',
  is_active  boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists estimate_snippets_vendor_idx on public.estimate_snippets (vendor_id, kind);
alter table public.estimate_snippets enable row level security;
drop policy if exists "Vendors manage own snippets" on public.estimate_snippets;
create policy "Vendors manage own snippets" on public.estimate_snippets
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ── Video library ────────────────────────────────────────────────────────────
create table if not exists public.estimate_videos (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  title      text not null,
  url        text not null,
  source     text not null default 'url',   -- youtube / vimeo / loom / url
  is_active  boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists estimate_videos_vendor_idx on public.estimate_videos (vendor_id);
alter table public.estimate_videos enable row level security;
drop policy if exists "Vendors manage own videos" on public.estimate_videos;
create policy "Vendors manage own videos" on public.estimate_videos
  using      (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));
