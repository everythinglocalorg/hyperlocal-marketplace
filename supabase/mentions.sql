-- ============================================================
-- @ MENTIONS — tag people and businesses in community posts.
-- Sets up the trust/referral graph + notification pings.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Denormalized list on the post for fast rendering: [{type,id,label,slug}]
alter table public.community_posts
  add column if not exists mentions jsonb default '[]'::jsonb;

-- The mention graph: who tagged whom, and where. Powers referrals,
-- "most-recommended", and notifications.
create table if not exists public.community_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('profile','vendor')),
  target_id uuid not null,
  created_at timestamptz default now()
);
create index if not exists community_mentions_target_idx
  on public.community_mentions(target_type, target_id);
alter table public.community_mentions enable row level security;
create policy "Anyone can read mentions" on public.community_mentions
  for select using (true);
create policy "Users insert own mentions" on public.community_mentions
  for insert with check (auth.uid() = author_id);

-- Generic notifications (tag pings now; reusable for anything later).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,   -- recipient
  actor_id uuid references public.profiles(id) on delete set null,          -- who triggered it
  type text not null,                                                       -- e.g. 'mention'
  title text,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx
  on public.notifications(user_id, is_read, created_at desc);
alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
-- The person doing the tagging creates the recipient's notification.
create policy "Authenticated create notifications" on public.notifications
  for insert with check (auth.uid() = actor_id);
