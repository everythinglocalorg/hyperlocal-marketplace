-- ============================================================
-- Everything Local — First-Party Analytics (event stream)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Complements analytics.sql (per-listing/vendor counters):
-- this table stores the raw behavioral event stream for SQL analysis.
-- ============================================================

-- ============================================================
-- EVENTS TABLE
-- Event types written by the client (src/lib/analytics.ts):
--   page_view, search, search_result_click, vendor_profile_view,
--   listing_view, listing_click, category_pill_click,
--   claim_banner_view, claim_banner_click, claim_completed,
--   sign_up, login
-- ============================================================
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) <= 64),
  event_data jsonb not null default '{}',
  user_id uuid references auth.users(id) on delete set null,
  session_id text check (char_length(session_id) <= 64),
  path text check (char_length(path) <= 2048),
  referrer text check (char_length(referrer) <= 2048),
  city_context text check (char_length(city_context) <= 128),
  device_type text check (device_type in ('mobile', 'tablet', 'desktop')),
  user_agent text check (char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  -- keep anonymous inserts from stuffing megabytes into jsonb
  constraint analytics_event_data_size check (pg_column_size(event_data) < 8192)
);

create index if not exists analytics_events_type_idx on public.analytics_events (event_type);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id) where user_id is not null;
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
create index if not exists analytics_events_data_gin_idx on public.analytics_events using gin (event_data jsonb_path_ops);

-- ============================================================
-- RLS: anyone can insert (guests included), only admins can read
-- ============================================================
alter table public.analytics_events enable row level security;

-- Guests insert with user_id null; logged-in users may only tag their own id
create policy "Anyone can log analytics events"
  on public.analytics_events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "Admins can read analytics events"
  on public.analytics_events for select
  to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- No update/delete policies: events are append-only for API clients.

-- ============================================================
-- REPORTING VIEWS
-- security_invoker so RLS still applies when queried through the
-- API; the SQL Editor (postgres role) sees everything regardless.
-- ============================================================

-- Top search terms with volume, reach, and zero-result share
create or replace view public.analytics_top_searches
with (security_invoker = true) as
select
  lower(trim(event_data->>'query')) as search_term,
  count(*) as searches,
  count(distinct session_id) as unique_sessions,
  round(avg(coalesce((event_data->>'result_count')::int, 0)), 1) as avg_results,
  count(*) filter (where coalesce((event_data->>'result_count')::int, 0) = 0) as zero_result_count,
  max(created_at) as last_searched_at
from public.analytics_events
where event_type = 'search'
  and coalesce(trim(event_data->>'query'), '') <> ''
group by 1
order by searches desc;

-- Searches that returned nothing — SEO/content gap list
create or replace view public.analytics_zero_result_searches
with (security_invoker = true) as
select
  lower(trim(event_data->>'query')) as search_term,
  event_data->>'category' as category,
  city_context,
  count(*) as searches,
  count(distinct session_id) as unique_sessions,
  max(created_at) as last_searched_at
from public.analytics_events
where event_type = 'search'
  and coalesce(trim(event_data->>'query'), '') <> ''
  and coalesce((event_data->>'result_count')::int, 0) = 0
group by 1, 2, 3
order by searches desc;

-- Click-through rate per query, with average clicked position
create or replace view public.analytics_search_ctr
with (security_invoker = true) as
with searches as (
  select lower(trim(event_data->>'query')) as search_term, count(*) as searches
  from public.analytics_events
  where event_type = 'search'
    and coalesce(trim(event_data->>'query'), '') <> ''
  group by 1
),
clicks as (
  select lower(trim(event_data->>'query')) as search_term,
         count(*) as clicks,
         round(avg((event_data->>'position')::numeric), 1) as avg_click_position
  from public.analytics_events
  where event_type = 'search_result_click'
    and coalesce(trim(event_data->>'query'), '') <> ''
  group by 1
)
select
  s.search_term,
  s.searches,
  coalesce(c.clicks, 0) as clicks,
  round(coalesce(c.clicks, 0)::numeric / s.searches, 3) as ctr,
  c.avg_click_position
from searches s
left join clicks c using (search_term)
order by s.searches desc;

-- ============================================================
-- EXAMPLE QUERIES (copy into the SQL Editor as needed)
-- ============================================================
-- Vendor profile views last 30 days, logged-in vs guest:
--   select event_data->>'vendor_slug' as vendor,
--          count(*) as views,
--          count(*) filter (where user_id is not null) as logged_in_views,
--          count(distinct session_id) as unique_visitors
--   from analytics_events
--   where event_type = 'vendor_profile_view'
--     and created_at > now() - interval '30 days'
--   group by 1 order by views desc;
--
-- Claim funnel:
--   select
--     count(*) filter (where event_type = 'claim_banner_view') as banner_views,
--     count(*) filter (where event_type = 'claim_banner_click') as banner_clicks,
--     count(*) filter (where event_type = 'claim_completed') as completed
--   from analytics_events
--   where created_at > now() - interval '30 days';
--
-- Traffic by device and referrer:
--   select device_type, referrer, count(*) as page_views
--   from analytics_events
--   where event_type = 'page_view'
--     and created_at > now() - interval '7 days'
--   group by 1, 2 order by page_views desc;
--
-- Guest journey for one session:
--   select created_at, event_type, path, event_data
--   from analytics_events
--   where session_id = '<session-uuid>'
--   order by created_at;
