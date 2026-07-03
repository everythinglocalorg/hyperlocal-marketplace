-- ============================================================================
-- EVERYTHING LOCAL — ALL PENDING MIGRATIONS (paste this whole file, run once)
-- Order matters: base migrations first, then Jobs Board, then launch promo.
-- (remove_chains.sql is destructive and intentionally NOT included.)
-- ============================================================================

-- ###################### PART 1: RUN_THESE ######################
-- ═════════════════════════════════════════════════════════════════════════════
-- EVERYTHING LOCAL — PENDING MIGRATIONS (run once, all at once)
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. Every statement uses "if not exists" / "if exists", so it is safe
-- to run again if any piece was already applied.
--
-- Covers: manual appointments, first-party analytics, service locations,
-- estimate customer-info + sending, per-listing CTA, claim tracking,
-- default 5-star rating, and claim verification (pending-request review).
-- (Chain/franchise cleanup is intentionally NOT included — see remove_chains.sql,
--  which is destructive and should be reviewed and run separately.
--  The Jobs Board is also separate — run supabase/jobs_board.sql once on its own.)
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) MANUAL APPOINTMENTS — vendors book walk-in / phone customers with no account
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings
  alter column buyer_id drop not null;

alter table public.bookings
  add column if not exists customer_name  text,
  add column if not exists customer_phone text,
  add column if not exists title          text;

alter table public.bookings
  add column if not exists source text not null default 'buyer';
-- source: 'buyer' = requested through the site, 'manual' = vendor created it

drop policy if exists "Vendors can create own bookings" on public.bookings;
create policy "Vendors can create own bookings" on public.bookings
  for insert with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) FIRST-PARTY ANALYTICS — raw behavioral event stream + reporting views
-- ─────────────────────────────────────────────────────────────────────────────
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
  constraint analytics_event_data_size check (pg_column_size(event_data) < 8192)
);

create index if not exists analytics_events_type_idx on public.analytics_events (event_type);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id) where user_id is not null;
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
create index if not exists analytics_events_data_gin_idx on public.analytics_events using gin (event_data jsonb_path_ops);

alter table public.analytics_events enable row level security;

drop policy if exists "Anyone can log analytics events" on public.analytics_events;
create policy "Anyone can log analytics events"
  on public.analytics_events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
  on public.analytics_events for select
  to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

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


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) SERVICE LOCATIONS — up to 10 towns a vendor serves (SEO areaServed)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors
  add column if not exists service_locations text[] not null default '{}';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) ESTIMATE SENDING — snapshot customer info + CRM contact address
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.estimates
  add column if not exists customer_name    text,
  add column if not exists customer_email   text,
  add column if not exists customer_phone   text,
  add column if not exists customer_address text,
  add column if not exists sent_at          timestamptz;

alter table public.crm_contacts
  add column if not exists address text;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) PER-LISTING CTA — book / estimate / call / menu / buy / rent
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.listings
  add column if not exists cta_type text
  check (cta_type in ('book', 'estimate', 'call', 'menu', 'buy', 'rent'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) CLAIM TRACKING — record when an unclaimed business is claimed
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors
  add column if not exists claimed_at timestamptz;

create or replace function claim_vendor(p_slug text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_vendor_id uuid;
  v_already_claimed boolean;
  v_claimer_has_vendor boolean;
begin
  select id, is_claimed into v_vendor_id, v_already_claimed
  from public.vendors where slug = p_slug limit 1;

  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'Vendor not found');
  end if;
  if v_already_claimed then
    return jsonb_build_object('ok', false, 'error', 'Already claimed');
  end if;

  select exists(select 1 from public.vendors where user_id = p_user_id)
  into v_claimer_has_vendor;
  if v_claimer_has_vendor then
    return jsonb_build_object('ok', false, 'error', 'You already have a vendor account');
  end if;

  update public.vendors
  set user_id = p_user_id, is_claimed = true, claimed_at = now()
  where id = v_vendor_id;

  update public.profiles set role = 'vendor' where id = p_user_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_vendor_id);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7) DEFAULT 5-STAR RATING — new/unreviewed vendors show 5 until a real review
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors alter column rating set default 5;
update public.vendors set rating = 5 where coalesce(review_count, 0) = 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8) CLAIM VERIFICATION — claims become pending requests an admin approves
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text,
  contact_email text,
  contact_phone text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now(),
  unique (vendor_id, user_id)
);

create index if not exists claim_requests_vendor_idx on public.claim_requests(vendor_id);
create index if not exists claim_requests_status_idx on public.claim_requests(status, created_at desc);

alter table public.claim_requests enable row level security;

drop policy if exists "Users create own claim requests" on public.claim_requests;
create policy "Users create own claim requests" on public.claim_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "View own or admin claim requests" on public.claim_requests;
create policy "View own or admin claim requests" on public.claim_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins update claim requests" on public.claim_requests;
create policy "Admins update claim requests" on public.claim_requests
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create or replace function approve_claim_request(p_request_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_req public.claim_requests;
  v_is_admin boolean;
begin
  select (is_admin = true) into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select * into v_req from public.claim_requests where id = p_request_id;
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request already ' || v_req.status);
  end if;

  if exists (select 1 from public.vendors where id = v_req.vendor_id and is_claimed = true) then
    update public.claim_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = 'Vendor already claimed'
      where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'Vendor already claimed');
  end if;

  if exists (select 1 from public.vendors where user_id = v_req.user_id) then
    return jsonb_build_object('ok', false, 'error', 'Claimer already owns a vendor');
  end if;

  update public.vendors
    set user_id = v_req.user_id, is_claimed = true, claimed_at = now()
    where id = v_req.vendor_id;
  update public.profiles set role = 'vendor' where id = v_req.user_id;
  update public.claim_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  update public.claim_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = 'Another request was approved'
    where vendor_id = v_req.vendor_id and status = 'pending' and id <> p_request_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_req.vendor_id);
end; $$;

create or replace function reject_claim_request(p_request_id uuid, p_note text default null)
returns jsonb language plpgsql security definer as $$
declare v_is_admin boolean;
begin
  select (is_admin = true) into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  update public.claim_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = coalesce(p_note, review_note)
    where id = p_request_id and status = 'pending';
  return jsonb_build_object('ok', true);
end; $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9) COVER REPOSITION — vertical framing of the business-page cover photo
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vendors
  add column if not exists banner_position integer not null default 50;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10) FOLLOWS / LIKES — follow a business or person; live follower counts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('vendor', 'user')),
  target_id uuid not null,
  created_at timestamptz default now(),
  unique (follower_id, target_type, target_id)
);
create index if not exists follows_target_idx on public.follows(target_type, target_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
alter table public.follows enable row level security;

drop policy if exists "Anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select using (true);
drop policy if exists "Users insert own follows" on public.follows;
create policy "Users insert own follows" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "Users delete own follows" on public.follows;
create policy "Users delete own follows" on public.follows for delete using (auth.uid() = follower_id);

do $$
begin
  alter publication supabase_realtime add table public.follows;
exception when others then null;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- Done. If you saw no errors, all ten features are ready.
-- (Jobs Board = run supabase/jobs_board.sql separately, once.)
-- ═════════════════════════════════════════════════════════════════════════════

-- ###################### PART 2: JOBS BOARD ######################
-- ============================================================
-- JOBS BOARD — public per-town job postings with a visibility radius
-- Jobs are posted to a town (city_slug) and carry that town's center
-- coords. radius_miles controls how far out nearby towns can see the
-- job via the jobs_nearby() RPC (modeled on search_vendors_nearby).
-- Run in the Supabase SQL Editor. Requires PostGIS (already enabled).
-- ============================================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  description text not null,
  job_type text not null default 'full_time', -- 'full_time' | 'part_time' | 'gig' | 'contract' | 'seasonal'
  pay_label text,                             -- free text: "$18-22/hr", "DOE"
  contact_email text,
  contact_phone text,
  application_url text,                       -- outside application link, if the business uses one
  city text not null,
  state text,
  city_slug text not null,                    -- e.g. "eau-claire-wi"
  latitude double precision,                  -- town center at post time
  longitude double precision,
  radius_miles integer not null default 25,   -- how far nearby towns can see it
  is_active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- Upgrade path for tables created before application_url existed
alter table public.jobs add column if not exists application_url text;

-- Indexes
create index if not exists jobs_city_slug_idx on public.jobs(city_slug);
create index if not exists jobs_created_idx on public.jobs(created_at desc);
create index if not exists jobs_lat_lng_idx on public.jobs(latitude, longitude);

-- RLS (mirrors community_posts)
alter table public.jobs enable row level security;

drop policy if exists "Anyone can view active jobs" on public.jobs;
create policy "Anyone can view active jobs" on public.jobs
  for select using (is_active = true or auth.uid() = user_id);

drop policy if exists "Authenticated users can post jobs" on public.jobs;
create policy "Authenticated users can post jobs" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs" on public.jobs
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own jobs" on public.jobs;
create policy "Users can delete own jobs" on public.jobs
  for delete using (auth.uid() = user_id);

drop policy if exists "Admins can delete any job" on public.jobs;
create policy "Admins can delete any job" on public.jobs
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- jobs_nearby — active jobs visible from a viewer's town center.
-- A job is visible when the viewer's center is within the JOB'S OWN
-- radius_miles of the job's town center (per-job reach, unlike the
-- viewer-radius in search_vendors_nearby). Newest first, with a
-- computed distance_miles.
-- ============================================================
-- Drop first: create-or-replace cannot change the return row type
drop function if exists jobs_nearby(double precision, double precision, integer, integer);

create or replace function jobs_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  vendor_id uuid,
  title text,
  description text,
  job_type text,
  pay_label text,
  contact_email text,
  contact_phone text,
  application_url text,
  city text,
  state text,
  city_slug text,
  radius_miles integer,
  is_active boolean,
  created_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision
) as $$
begin
  return query
  select
    j.id,
    j.user_id,
    j.vendor_id,
    j.title,
    j.description,
    j.job_type,
    j.pay_label,
    j.contact_email,
    j.contact_phone,
    j.application_url,
    j.city,
    j.state,
    j.city_slug,
    j.radius_miles,
    j.is_active,
    j.created_at,
    j.expires_at,
    st_distance(
      st_point(j.longitude, j.latitude)::geography,
      st_point(p_longitude, p_latitude)::geography
    ) / 1609.34 as distance_miles
  from public.jobs j
  where
    j.is_active = true
    and (j.expires_at is null or j.expires_at > now())
    and j.latitude is not null
    and j.longitude is not null
    and st_dwithin(
      st_point(j.longitude, j.latitude)::geography,
      st_point(p_longitude, p_latitude)::geography,
      j.radius_miles * 1609.34
    )
  order by j.created_at desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

-- ###################### PART 3: LAUNCH PROMO ######################
-- ─────────────────────────────────────────────────────────────────────────────
-- LAUNCH PROMO — every business gets Local Pro+ (premium + all features) free.
-- Upgrades existing vendors and makes claim-approval grant it automatically.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Upgrade every existing business to the top tier
update public.vendors
set tier = 'premium',
    features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb;

-- 2) When an admin approves a claim, grant Local Pro+ too (launch promo)
create or replace function approve_claim_request(p_request_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_req public.claim_requests;
  v_is_admin boolean;
begin
  select (is_admin = true) into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select * into v_req from public.claim_requests where id = p_request_id;
  if v_req.id is null then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request already ' || v_req.status);
  end if;

  if exists (select 1 from public.vendors where id = v_req.vendor_id and is_claimed = true) then
    update public.claim_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = 'Vendor already claimed'
      where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'Vendor already claimed');
  end if;

  if exists (select 1 from public.vendors where user_id = v_req.user_id) then
    return jsonb_build_object('ok', false, 'error', 'Claimer already owns a vendor');
  end if;

  update public.vendors
    set user_id = v_req.user_id,
        is_claimed = true,
        claimed_at = now(),
        tier = 'premium',
        features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb
    where id = v_req.vendor_id;
  update public.profiles set role = 'vendor' where id = v_req.user_id;

  update public.claim_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  update public.claim_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = 'Another request was approved'
    where vendor_id = v_req.vendor_id and status = 'pending' and id <> p_request_id;

  return jsonb_build_object('ok', true, 'vendor_id', v_req.vendor_id);
end; $$;

-- 3) Also grant it via the direct claim_vendor RPC (legacy/instant-claim path)
create or replace function claim_vendor(p_slug text, p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_vendor_id uuid;
  v_already_claimed boolean;
  v_claimer_has_vendor boolean;
begin
  select id, is_claimed into v_vendor_id, v_already_claimed
  from public.vendors where slug = p_slug limit 1;
  if v_vendor_id is null then return jsonb_build_object('ok', false, 'error', 'Vendor not found'); end if;
  if v_already_claimed then return jsonb_build_object('ok', false, 'error', 'Already claimed'); end if;
  select exists(select 1 from public.vendors where user_id = p_user_id) into v_claimer_has_vendor;
  if v_claimer_has_vendor then return jsonb_build_object('ok', false, 'error', 'You already have a vendor account'); end if;

  update public.vendors
    set user_id = p_user_id, is_claimed = true, claimed_at = now(),
        tier = 'premium',
        features = '{"messages":true,"analytics":true,"bookings":true,"crm":true,"estimates":true}'::jsonb
    where id = v_vendor_id;
  update public.profiles set role = 'vendor' where id = p_user_id;
  return jsonb_build_object('ok', true, 'vendor_id', v_vendor_id);
end; $$;
