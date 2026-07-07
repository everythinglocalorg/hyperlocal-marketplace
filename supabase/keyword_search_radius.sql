-- Make keyword_search radius-aware instead of exact-city.
-- Bug: searching "landscaping" from Faribault returned 0 because the RPC
-- filtered vendors/listings to city = 'Faribault' exactly, dropping every
-- match in nearby Eau Claire / Northfield. The rest of the app uses a radius.
-- Now it looks up the searched city's center (public.cities) and keeps any
-- match within p_radius_miles (default 100), plus any vendor with no coords.
-- Title + tags + category + description are already indexed in search_vector.
--
-- Also adds a pg_trgm fallback so agent-noun searches match the "-ing/-y" forms
-- the English stemmer treats as different words: "plumber"→plumbing,
-- "baker"→bakery, "roofer"→roofing, "electrician"→electrical. Full-text stays
-- the primary, ranked match; trigram similarity only broadens recall.

create extension if not exists pg_trgm;

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
  rank real
) as $$
declare
  search_query tsquery;
  c_lat double precision;
  c_lng double precision;
begin
  search_query := websearch_to_tsquery('english', p_query);

  -- Center of the searched city (null when unknown → no geo filter, so we
  -- never silently drop matches).
  select ct.latitude, ct.longitude into c_lat, c_lng
  from public.cities ct where ct.slug = p_city_slug;

  return query
  select
    'vendor'::text, v.id, v.slug, v.business_name, v.category, v.logo_url,
    v.city, v.state, v.rating, v.tier, v.is_verified,
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
    v2.city, v2.state, v2.rating, v2.tier, v2.is_verified,
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
