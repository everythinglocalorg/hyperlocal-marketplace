-- Local Experiences (see docs/local-experiences.md). An Experience IS a listings
-- row with type='experience' + cta_type='book' (so it reuses product cards,
-- Explore/search, and the booking flow). These two tables add the itinerary +
-- release/meta state. Draft = listing.is_active false; published = true.

-- Allow the new 'experience' listing type.
alter table public.listings drop constraint if exists listings_type_check;
alter table public.listings add constraint listings_type_check
  check (type = any (array['product','service','restaurant','event','rental','thrift','experience']));

-- Per-experience meta + release state (keyed to the experience listing).
create table if not exists public.experience_meta (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  is_published boolean not null default false,
  first_published_at timestamptz,          -- set once; $50 first release, $10 re-publish
  theme text[] not null default '{}',
  duration_label text,                     -- e.g. "Weekend", "Half day"
  best_for text,
  est_cost_cents integer,
  updated_at timestamptz not null default now()
);

-- Ordered itinerary stops. A stop references a real site entity (vendor/listing/
-- place) OR is a custom free-text stop with an optional geocoded address.
create table if not exists public.experience_stops (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  day integer not null default 1,
  position integer not null default 0,
  start_time time,
  duration_min integer,
  title text not null,
  notes text,
  ref_type text not null default 'custom' check (ref_type in ('vendor','listing','place','custom')),
  ref_id uuid,
  custom_address text,
  custom_lat double precision,
  custom_lng double precision,
  created_at timestamptz not null default now()
);
create index if not exists idx_experience_stops_listing on public.experience_stops(listing_id, day, position);

alter table public.experience_meta enable row level security;
alter table public.experience_stops enable row level security;

-- Public can read (they're only meaningful for an experience listing, whose own
-- is_active gates whether it's shown at all). Owner (listing -> vendor -> user)
-- manages both.
drop policy if exists "public read experience_meta" on public.experience_meta;
create policy "public read experience_meta" on public.experience_meta for select using (true);
drop policy if exists "owner manage experience_meta" on public.experience_meta;
create policy "owner manage experience_meta" on public.experience_meta for all
  using (auth.uid() = (select v.user_id from public.vendors v join public.listings l on l.vendor_id = v.id where l.id = listing_id))
  with check (auth.uid() = (select v.user_id from public.vendors v join public.listings l on l.vendor_id = v.id where l.id = listing_id));

drop policy if exists "public read experience_stops" on public.experience_stops;
create policy "public read experience_stops" on public.experience_stops for select using (true);
drop policy if exists "owner manage experience_stops" on public.experience_stops;
create policy "owner manage experience_stops" on public.experience_stops for all
  using (auth.uid() = (select v.user_id from public.vendors v join public.listings l on l.vendor_id = v.id where l.id = listing_id))
  with check (auth.uid() = (select v.user_id from public.vendors v join public.listings l on l.vendor_id = v.id where l.id = listing_id));
