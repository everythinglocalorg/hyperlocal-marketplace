-- Remember each user's preferred search distance (miles).
alter table public.profiles
  add column if not exists default_radius integer default 50;
