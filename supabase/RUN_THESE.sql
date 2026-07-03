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
