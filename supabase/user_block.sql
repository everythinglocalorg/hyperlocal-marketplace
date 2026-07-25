-- Block/suspend support for the Admin > Users tab.
-- Actual login enforcement is handled by Supabase Auth (the admin API bans the
-- user with a ban_duration). These columns mirror that state on the profile so
-- the admin list can show who is blocked, when, and why.

alter table public.profiles
  add column if not exists blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;

-- Helpful for filtering/reporting on blocked accounts.
create index if not exists profiles_blocked_idx on public.profiles (blocked) where blocked;
