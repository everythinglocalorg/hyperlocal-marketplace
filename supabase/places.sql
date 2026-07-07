-- ============================================================
-- PLACES — parks, campgrounds, attractions, things to do
-- Public read; authenticated insert; owner/claimer can edit.
-- Requires PostGIS (already enabled).
-- ============================================================

create table if not exists public.places (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,             -- name-city-state, e.g. "lake-wissota-eau-claire-wi"
  name         text not null,
  type         text not null,                    -- 'park' | 'campground' | 'attraction' | 'thing_to_do'
  subtype      text,                             -- "state park", "waterfall", "disc golf course"
  description  text,
  address      text,
  city         text not null,
  state        text not null,
  zip          text,
  city_slug    text not null,                    -- e.g. "eau-claire-wi"
  latitude     double precision,
  longitude    double precision,
  location     geography(Point, 4326)
               generated always as (
                 case when latitude is not null and longitude is not null
                   then st_point(longitude, latitude)::geography
                 end
               ) stored,
  images       text[]   not null default '{}',
  tags         text[]   not null default '{}',
  amenities    text[]   not null default '{}',   -- restrooms, parking, trails, water access, …
  activities   text[]   not null default '{}',   -- hiking, swimming, fishing, camping, …
  hours        jsonb,                            -- {mon:"8am-dusk", …, seasonal:"May–Oct"}
  fees         text     not null default 'free', -- 'free' | 'day-use' | 'camping' | 'varies'
  fee_details  text,                             -- "$5/vehicle, $25/night"
  website      text,
  phone        text,
  created_by   uuid references public.profiles(id) on delete set null not null,
  is_claimed   boolean  not null default false,
  claimed_by   uuid references public.profiles(id) on delete set null,
  claimed_at   timestamptz,
  search_vector tsvector,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists places_city_slug_idx   on public.places(city_slug);
create index if not exists places_created_idx     on public.places(created_at desc);
create index if not exists places_type_idx        on public.places(type);
create index if not exists places_tags_idx        on public.places using gin(tags);
create index if not exists places_amenities_idx   on public.places using gin(amenities);
create index if not exists places_activities_idx  on public.places using gin(activities);
create index if not exists places_search_idx      on public.places using gin(search_vector);
create index if not exists places_location_idx    on public.places using gist(location);

-- RLS
alter table public.places enable row level security;

drop policy if exists "Anyone can view places" on public.places;
create policy "Anyone can view places" on public.places
  for select using (true);

drop policy if exists "Authenticated users can add places" on public.places;
create policy "Authenticated users can add places" on public.places
  for insert with check (auth.uid() = created_by);

drop policy if exists "Creator or claimer can update place" on public.places;
create policy "Creator or claimer can update place" on public.places
  for update using (
    auth.uid() = created_by or auth.uid() = claimed_by
  );

drop policy if exists "Admins can delete any place" on public.places;
create policy "Admins can delete any place" on public.places
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Auto-update search_vector + updated_at on insert/update
-- Weights: A=name, B=type/subtype/tags, C=description, D=city+state
-- ============================================================
create or replace function update_place_search_vector()
returns trigger as $$
begin
  new.updated_at := now();
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.type, '') || ' ' || coalesce(new.subtype, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.city, '') || ' ' || coalesce(new.state, '')), 'D');
  return new;
end;
$$ language plpgsql;

drop trigger if exists places_search_vector_update on public.places;
create trigger places_search_vector_update
  before insert or update on public.places
  for each row execute function update_place_search_vector();

-- ============================================================
-- places_nearby — places within p_radius_miles of viewer coords.
-- Optional: p_tags (array overlap), p_type filter.
-- Returns distance_miles via PostGIS.
-- ============================================================
drop function if exists places_nearby(double precision, double precision, integer, integer, integer, text[], text);

create or replace function places_nearby(
  p_latitude     double precision,
  p_longitude    double precision,
  p_radius_miles integer default 50,
  p_limit        integer default 50,
  p_offset       integer default 0,
  p_tags         text[]  default null,
  p_type         text    default null
)
returns table (
  id             uuid,
  slug           text,
  name           text,
  type           text,
  subtype        text,
  description    text,
  address        text,
  city           text,
  state          text,
  city_slug      text,
  latitude       double precision,
  longitude      double precision,
  images         text[],
  tags           text[],
  amenities      text[],
  activities     text[],
  fees           text,
  fee_details    text,
  website        text,
  phone          text,
  created_by     uuid,
  is_claimed     boolean,
  claimed_by     uuid,
  created_at     timestamptz,
  distance_miles double precision
) as $$
begin
  return query
  select
    p.id, p.slug, p.name, p.type, p.subtype,
    p.description, p.address, p.city, p.state, p.city_slug,
    p.latitude, p.longitude, p.images, p.tags, p.amenities,
    p.activities, p.fees, p.fee_details, p.website, p.phone,
    p.created_by, p.is_claimed, p.claimed_by, p.created_at,
    st_distance(
      p.location,
      st_point(p_longitude, p_latitude)::geography
    ) / 1609.34 as distance_miles
  from public.places p
  where
    p.location is not null
    and st_dwithin(
      p.location,
      st_point(p_longitude, p_latitude)::geography,
      p_radius_miles * 1609.34
    )
    and (p_tags is null or p.tags && p_tags)
    and (p_type is null or p.type = p_type)
  order by distance_miles asc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

-- ============================================================
-- places_search — full-text keyword search, optionally scoped
-- to a city_slug, tag set, or type. Used on the explore page.
-- ============================================================
drop function if exists places_search(text, text, text[], text, integer, integer);

create or replace function places_search(
  p_query      text,
  p_city_slug  text    default null,
  p_tags       text[]  default null,
  p_type       text    default null,
  p_limit      integer default 30,
  p_offset     integer default 0
)
returns table (
  id          uuid,
  slug        text,
  name        text,
  type        text,
  subtype     text,
  description text,
  city        text,
  state       text,
  city_slug   text,
  images      text[],
  tags        text[],
  fees        text,
  website     text,
  is_claimed  boolean,
  created_at  timestamptz,
  rank        real
) as $$
declare
  search_query tsquery;
begin
  search_query := websearch_to_tsquery('english', p_query);
  return query
  select
    p.id, p.slug, p.name, p.type, p.subtype,
    p.description, p.city, p.state, p.city_slug,
    p.images, p.tags, p.fees, p.website, p.is_claimed, p.created_at,
    ts_rank(p.search_vector, search_query) as rank
  from public.places p
  where
    p.search_vector @@ search_query
    and (p_city_slug is null or p.city_slug = p_city_slug)
    and (p_tags      is null or p.tags      && p_tags)
    and (p_type      is null or p.type       = p_type)
  order by rank desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;
