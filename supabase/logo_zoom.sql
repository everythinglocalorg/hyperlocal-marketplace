-- Per-vendor logo zoom so businesses can scale their logo to fit the card
-- (avoids tall/wide logos getting clipped). Default 1 = no zoom.
alter table public.vendors add column if not exists logo_zoom real not null default 1;

-- keyword_search must return logo_zoom so the search cards can apply it.
drop function if exists keyword_search(text, text, text, integer, integer);
drop function if exists keyword_search(text, text, text, integer, integer, integer);

create or replace function keyword_search(
  p_query text,
  p_city_slug text default null,
  p_type text default 'all',
  p_limit integer default 20,
  p_offset integer default 0,
  p_radius_miles integer default 100
)
returns table (
  result_type text,
  id uuid,
  slug text,
  title text,
  subtitle text,
  image_url text,
  city text,
  state text,
  rating numeric,
  tier text,
  is_verified boolean,
  logo_zoom real,
  rank real
) as $$
declare
  search_query tsquery;
  c_lat double precision;
  c_lng double precision;
begin
  search_query := websearch_to_tsquery('english', p_query);

  select ct.latitude, ct.longitude into c_lat, c_lng
  from public.cities ct where ct.slug = p_city_slug;

  return query
  select
    'vendor'::text, v.id, v.slug, v.business_name, v.category, v.logo_url,
    v.city, v.state, v.rating, v.tier, v.is_verified, v.logo_zoom,
    greatest(ts_rank(v.search_vector, search_query),
             word_similarity(p_query, coalesce(v.business_name,'') || ' ' || coalesce(v.category,'') || ' ' || coalesce(v.description,''))) as rank
  from public.vendors v
  where v.is_active = true
    and (
      v.search_vector @@ search_query
      or word_similarity(p_query, coalesce(v.business_name,'') || ' ' || coalesce(v.category,'') || ' ' || coalesce(v.description,'')) >= 0.4
    )
    and (
      c_lat is null or v.location is null
      or st_dwithin(v.location, st_point(c_lng, c_lat)::geography, p_radius_miles * 1609.34)
    )
    and (p_type = 'all' or p_type = 'vendors')

  union all

  select
    'listing'::text, l.id, v2.slug, l.title, l.category, l.images[1],
    v2.city, v2.state, v2.rating, v2.tier, v2.is_verified, 1::real,
    greatest(ts_rank(l.search_vector, search_query),
             word_similarity(p_query, coalesce(l.title,'') || ' ' || coalesce(l.category,'') || ' ' || coalesce(l.description,''))) as rank
  from public.listings l
  join public.vendors v2 on v2.id = l.vendor_id
  where l.is_active = true and v2.is_active = true
    and (
      l.search_vector @@ search_query
      or word_similarity(p_query, coalesce(l.title,'') || ' ' || coalesce(l.category,'') || ' ' || coalesce(l.description,'')) >= 0.4
    )
    and (
      c_lat is null or v2.location is null
      or st_dwithin(v2.location, st_point(c_lng, c_lat)::geography, p_radius_miles * 1609.34)
    )
    and (p_type = 'all' or p_type = 'listings')

  order by rank desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

-- search_vendors_nearby also returns logo_zoom for the nearby-browse cards.
drop function if exists search_vendors_nearby(double precision, double precision, integer, text, integer, integer);
create or replace function search_vendors_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_miles integer default 25,
  p_category text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, business_name text, slug text, description text, category text,
  city text, state text, logo_url text, banner_url text, logo_zoom real,
  tier text, is_verified boolean, rating numeric, review_count integer,
  local_bucks_earned integer, distance_miles double precision
) as $$
begin
  return query
  select
    v.id, v.business_name, v.slug, v.description, v.category, v.city, v.state,
    v.logo_url, v.banner_url, v.logo_zoom, v.tier, v.is_verified, v.rating,
    v.review_count, v.local_bucks_earned,
    st_distance(v.location, st_point(p_longitude, p_latitude)::geography) / 1609.34 as distance_miles
  from public.vendors v
  where v.is_active = true
    and st_dwithin(v.location, st_point(p_longitude, p_latitude)::geography, p_radius_miles * 1609.34)
    and (p_category is null or v.category = p_category)
  order by distance_miles asc
  limit p_limit offset p_offset;
end;
$$ language plpgsql security definer;
