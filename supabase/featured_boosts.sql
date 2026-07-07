-- Paid feature boosts (Stripe monthly subscription). Distinct from the Local
-- Bucks `boosts` table — this one is cash-billed via Stripe. A boost features a
-- listing or a vendor in a high-visibility spot; activated by the webhook once
-- the subscription is paid, deactivated when it lapses or is cancelled.
--   placement 'homepage'    → Featured Gems (listing) / New Businesses (vendor), $5/mo
--   placement 'local_pages' → the city's Local Pages board, $10/mo

create table if not exists public.featured_boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade,
  entity_type text not null check (entity_type in ('listing', 'vendor')),
  entity_id uuid not null,
  placement text not null check (placement in ('homepage', 'local_pages')),
  city_slug text,
  stripe_subscription_id text,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists featured_boosts_entity_idx on public.featured_boosts(entity_type, entity_id);
create index if not exists featured_boosts_active_idx on public.featured_boosts(placement, is_active);
create index if not exists featured_boosts_city_idx on public.featured_boosts(city_slug);

alter table public.featured_boosts enable row level security;

drop policy if exists "Anyone can view active featured boosts" on public.featured_boosts;
create policy "Anyone can view active featured boosts" on public.featured_boosts
  for select using (is_active = true or auth.uid() = user_id);

drop policy if exists "Users insert own featured boosts" on public.featured_boosts;
create policy "Users insert own featured boosts" on public.featured_boosts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own featured boosts" on public.featured_boosts;
create policy "Users update own featured boosts" on public.featured_boosts
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own featured boosts" on public.featured_boosts;
create policy "Users delete own featured boosts" on public.featured_boosts
  for delete using (auth.uid() = user_id);
