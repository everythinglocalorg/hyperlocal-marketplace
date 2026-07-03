-- ─────────────────────────────────────────────────────────────────────────────
-- Follows / Likes — a user can follow a business (vendor) or a person (profile).
-- Counts render in real time on public pages via Supabase Realtime.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste this file → Run
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
create policy "Anyone can view follows" on public.follows
  for select using (true);

drop policy if exists "Users insert own follows" on public.follows;
create policy "Users insert own follows" on public.follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "Users delete own follows" on public.follows;
create policy "Users delete own follows" on public.follows
  for delete using (auth.uid() = follower_id);

-- Enable realtime broadcasts for live follower counts (safe if already added)
do $$
begin
  alter publication supabase_realtime add table public.follows;
exception
  when others then null;
end $$;
