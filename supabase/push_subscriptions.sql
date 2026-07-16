-- Web Push subscriptions — one row per browser/device a user opts in from.
-- Idempotent: safe to re-run.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null unique,          -- the push service URL (identifies the device)
  p256dh text not null,                   -- client public key
  auth text not null,                     -- client auth secret
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own device subscriptions. Sending is done server-side
-- with the service role, which bypasses RLS.
drop policy if exists "Users insert own push subscriptions" on public.push_subscriptions;
create policy "Users insert own push subscriptions" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.push_subscriptions to authenticated;
