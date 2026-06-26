-- ============================================================
-- RUN-ALL for recent features (Top 8, About You, @ mentions, analytics).
-- Fully idempotent — safe to run multiple times. Run this once in:
-- Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- ============================================================

-- ---- Vendor page content blocks --------------------------------------------
alter table public.vendors add column if not exists page_blocks jsonb default '[]'::jsonb;

-- ---- Top 8 Local Picks ------------------------------------------------------
create table if not exists public.profile_business_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  position smallint not null check (position between 1 and 8),
  created_at timestamptz default now(),
  unique (user_id, vendor_id),
  unique (user_id, position)
);
create index if not exists profile_business_picks_user_idx on public.profile_business_picks(user_id, position);
alter table public.profile_business_picks enable row level security;
drop policy if exists "Anyone can view profile picks" on public.profile_business_picks;
drop policy if exists "Users can insert own picks" on public.profile_business_picks;
drop policy if exists "Users can update own picks" on public.profile_business_picks;
drop policy if exists "Users can delete own picks" on public.profile_business_picks;
create policy "Anyone can view profile picks" on public.profile_business_picks for select using (true);
create policy "Users can insert own picks" on public.profile_business_picks for insert with check (auth.uid() = user_id);
create policy "Users can update own picks" on public.profile_business_picks for update using (auth.uid() = user_id);
create policy "Users can delete own picks" on public.profile_business_picks for delete using (auth.uid() = user_id);

-- ---- "About You" profile boxes ---------------------------------------------
alter table public.profiles add column if not exists profile_details jsonb default '{}'::jsonb;

-- ---- @ mentions (people + businesses) --------------------------------------
alter table public.community_posts add column if not exists mentions jsonb default '[]'::jsonb;
alter table public.community_responses add column if not exists mentions jsonb default '[]'::jsonb;

create table if not exists public.community_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('profile','vendor')),
  target_id uuid not null,
  created_at timestamptz default now()
);
create index if not exists community_mentions_target_idx on public.community_mentions(target_type, target_id);
alter table public.community_mentions enable row level security;
drop policy if exists "Anyone can read mentions" on public.community_mentions;
drop policy if exists "Users insert own mentions" on public.community_mentions;
create policy "Anyone can read mentions" on public.community_mentions for select using (true);
create policy "Users insert own mentions" on public.community_mentions for insert with check (auth.uid() = author_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text, body text, link text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Authenticated create notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Authenticated create notifications" on public.notifications for insert with check (auth.uid() = actor_id);

-- ---- Listing + store analytics counters ------------------------------------
create or replace function public.increment_vendor_listing_views(vendor_id_in uuid)
returns void language sql security definer set search_path = public as $$
  update public.listings set view_count = coalesce(view_count,0)+1
   where vendor_id = vendor_id_in and is_active = true;
$$;
create or replace function public.increment_listing_clicks(listing_id_in uuid)
returns void language sql security definer set search_path = public as $$
  update public.listings set click_count = coalesce(click_count,0)+1 where id = listing_id_in;
$$;
alter table public.vendors add column if not exists profile_views integer default 0;
create or replace function public.increment_vendor_profile_views(vendor_id_in uuid)
returns void language sql security definer set search_path = public as $$
  update public.vendors set profile_views = coalesce(profile_views,0)+1 where id = vendor_id_in;
$$;
grant execute on function public.increment_vendor_listing_views(uuid) to anon, authenticated;
grant execute on function public.increment_listing_clicks(uuid) to anon, authenticated;
grant execute on function public.increment_vendor_profile_views(uuid) to anon, authenticated;
