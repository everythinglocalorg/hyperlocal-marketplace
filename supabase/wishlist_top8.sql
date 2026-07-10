-- Wish List (saved listings) + Top 8 (favorite businesses) — both per-user and
-- private to that user. Adding a business to your Top 8 also follows it (handled
-- app-side); following alone does NOT add to Top 8.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create index if not exists idx_wishlist_user on public.wishlist_items(user_id, created_at desc);

alter table public.wishlist_items enable row level security;
drop policy if exists "own wishlist" on public.wishlist_items;
create policy "own wishlist" on public.wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.top8_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, vendor_id)
);
create index if not exists idx_top8_user on public.top8_businesses(user_id, position);

alter table public.top8_businesses enable row level security;
drop policy if exists "own top8" on public.top8_businesses;
create policy "own top8" on public.top8_businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
