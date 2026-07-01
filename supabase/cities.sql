-- ============================================================
-- CITIES — cached geocoded city centers for radius search
-- Center coords are used as the origin point for search_vendors_nearby.
-- Populated lazily by /api/cities/resolve (geocodes via OpenStreetMap once
-- per city, then caches here so every later search is free + instant).
-- ============================================================
create table if not exists public.cities (
  slug        text primary key,
  city        text not null,
  state       text not null,
  latitude    double precision,
  longitude   double precision,
  created_at  timestamptz not null default now()
);

alter table public.cities enable row level security;

-- Anyone can read city centers (needed for browsing while logged out)
drop policy if exists "cities readable by all" on public.cities;
create policy "cities readable by all" on public.cities
  for select using (true);

-- Writes happen only via the service-role API route, so no insert/update
-- policy is defined for anon/authenticated (service role bypasses RLS).

-- Seed the two launch markets with known-good centers
insert into public.cities (slug, city, state, latitude, longitude) values
  ('eau-claire-wi', 'Eau Claire', 'WI', 44.8113, -91.4985),
  ('faribault-mn',  'Faribault',  'MN', 44.2955, -93.2688)
on conflict (slug) do nothing;
