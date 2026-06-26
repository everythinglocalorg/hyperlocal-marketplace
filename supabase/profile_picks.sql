-- ============================================================
-- PROFILE BUSINESS PICKS — a user's hand-picked "Top 8" local
-- businesses, shown on their public profile at /u/[id].
-- In the app, picks are sourced from businesses the user has
-- engaged with (messaged, reviewed, or booked).
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
create table if not exists public.profile_business_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  position smallint not null check (position between 1 and 8),
  created_at timestamptz default now(),
  unique (user_id, vendor_id),
  unique (user_id, position)
);

create index if not exists profile_business_picks_user_idx
  on public.profile_business_picks(user_id, position);

alter table public.profile_business_picks enable row level security;

-- Picks appear on public profiles, so anyone can read them.
create policy "Anyone can view profile picks" on public.profile_business_picks
  for select using (true);

-- Only the owner can manage their own picks.
create policy "Users can insert own picks" on public.profile_business_picks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own picks" on public.profile_business_picks
  for update using (auth.uid() = user_id);

create policy "Users can delete own picks" on public.profile_business_picks
  for delete using (auth.uid() = user_id);
