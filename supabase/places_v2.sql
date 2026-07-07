-- ============================================================
-- PLACES v2 — add is_active, vendor_id, stripe_subscription_id
-- Update RPCs to filter is_active. Update seed photo URLs.
-- ============================================================

-- New columns
alter table public.places
  add column if not exists is_active            boolean not null default true,
  add column if not exists vendor_id            uuid references public.vendors(id) on delete set null,
  add column if not exists stripe_subscription_id text;

-- Paid types (attraction, thing_to_do, food_truck) start inactive until Stripe confirms.
-- park + campground are free and start active (handled in app on insert).

-- RLS: public sees only active places; creator always sees their own.
drop policy if exists "Anyone can view places" on public.places;
create policy "Anyone can view places" on public.places
  for select using (is_active = true or auth.uid() = created_by);

-- ============================================================
-- places_nearby — updated to respect is_active
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
  vendor_id      uuid,
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
    p.created_by, p.vendor_id, p.is_claimed, p.claimed_by, p.created_at,
    st_distance(
      p.location,
      st_point(p_longitude, p_latitude)::geography
    ) / 1609.34 as distance_miles
  from public.places p
  where
    p.is_active = true
    and p.location is not null
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
-- places_search — updated to respect is_active
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
  vendor_id   uuid,
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
    p.images, p.tags, p.fees, p.website, p.is_claimed, p.vendor_id,
    p.created_at,
    ts_rank(p.search_vector, search_query) as rank
  from public.places p
  where
    p.is_active = true
    and p.search_vector @@ search_query
    and (p_city_slug is null or p.city_slug = p_city_slug)
    and (p_tags      is null or p.tags      && p_tags)
    and (p_type      is null or p.type       = p_type)
  order by rank desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Seed photo URLs for the 10 Faribault-area campsites
-- ============================================================
update public.places set images = array['https://source.unsplash.com/7ERJvxUKftA/1200x800']
  where slug = 'nerstrand-big-woods-state-park-nerstrand-mn';

update public.places set images = array['https://source.unsplash.com/x67IZeAqFLE/1200x800']
  where slug = 'sakatah-lake-state-park-waterville-mn';

update public.places set images = array['https://source.unsplash.com/RsKjj6Xj49k/1200x800']
  where slug = 'camp-faribo-family-campground-faribault-mn';

update public.places set images = array['https://source.unsplash.com/JMWjh5nCeJ4/1200x800']
  where slug = 'cannon-river-wilderness-area-faribault-mn';

update public.places set images = array['https://source.unsplash.com/jZLFAYLEf18/1200x800']
  where slug = 'rice-lake-state-park-owatonna-mn';

update public.places set images = array['https://source.unsplash.com/jytE0FX7Eds/1200x800']
  where slug = 'minneopa-state-park-mankato-mn';

update public.places set images = array['https://source.unsplash.com/x67IZeAqFLE/1200x800']
  where slug = 'lake-byllesby-regional-park-randolph-mn';

update public.places set images = array['https://source.unsplash.com/RsKjj6Xj49k/1200x800']
  where slug = 'mccullough-park-and-campground-faribault-mn';

update public.places set images = array['https://source.unsplash.com/7ERJvxUKftA/1200x800']
  where slug = 'lebanon-hills-regional-park-eagan-mn';

update public.places set images = array['https://source.unsplash.com/VWsyhRvQdyQ/1200x800']
  where slug = 'afton-state-park-afton-mn';
