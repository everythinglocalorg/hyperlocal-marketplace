-- Search relevance overhaul — precision-first + location-aware keyword_search.
--
-- Fixes (in order they were found):
--  1. "home for rent" returned "Roof Rejuvenation" + 18 services.
--     Cause: the trigram fallback matched the whole DESCRIPTION, so "homes" in a
--     roofing blurb cleared the threshold. → trigram now targets TITLE+CATEGORY
--     only, at 0.5.
--  2. "food" in Eau Claire returned ONE business, from Mondovi.
--     Cause: intent dropped ALL vendors, and only that one had matching
--     restaurant-type listings; and distance never affected ranking.
--     → Split intent into PROPERTY intent (housing: keep the hard filter + drop
--       vendors — a "home for rent" search wants homes, not businesses) vs
--       CATEGORY intent (food/thrift: BOOST the type but keep vendors so local
--       restaurants show), and add distance decay to ranking so nearer results
--       rank above farther ones within the radius.
--
-- search_vector is already field-weighted (setweight A=title/name, B=category/
-- tags, C=description) with triggers, so ts_rank_cd gives title >> description.

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
  center geography;
  q text := lower(coalesce(p_query, ''));
  intent_types text[] := '{}';
  is_property boolean := false;  -- housing/for-sale → hard filter + drop vendors
  home_word boolean;
begin
  search_query := websearch_to_tsquery('english', p_query);

  select ct.latitude, ct.longitude into c_lat, c_lng
  from public.cities ct where ct.slug = p_city_slug;
  center := case when c_lat is null then null
                 else st_point(c_lng, c_lat)::geography end;

  home_word := q ~ '\y(home|homes|house|houses|apartment|apt|condo|townhouse|townhome|duplex|studio|room|place)\y';

  -- ── Intent ────────────────────────────────────────────────────────────
  if q ~ '\y(for sale|for-sale)\y' and home_word then
    intent_types := array['housing_sale']; is_property := true;
  elsif q ~ '\y(rent|renting|rental|rentals|lease|leasing)\y' then
    intent_types := case when home_word then array['housing_rent']
                         else array['housing_rent','rental'] end;
    is_property := true;
  elsif q ~ '\y(eat|food|restaurant|restaurants|menu|dinner|lunch|breakfast|brunch|takeout|take-out|delivery|dine|cafe|coffee|taco|tacos|pizza|burger|burgers|sushi|bbq|diner)\y' then
    intent_types := array['restaurant'];  -- category boost, NOT a hard filter
  elsif q ~ '\y(thrift|secondhand|second-hand|garage sale|rummage|estate sale|consignment)\y' then
    intent_types := array['thrift'];
  end if;

  return query
  with matches as (
    -- ── Listings ──
    select
      'listing'::text as result_type, l.id, v2.slug, l.title, l.category as subtitle,
      l.images[1] as image_url, v2.city, v2.state, v2.rating, v2.tier, v2.is_verified,
      l.type as ltype,
      ts_rank_cd(l.search_vector, search_query) as fts_rank,
      (l.search_vector @@ search_query) as fts_hit,
      word_similarity(q, lower(coalesce(l.title,'') || ' ' || coalesce(l.category,''))) as trg,
      case when center is null or v2.location is null then null
           else st_distance(v2.location, center) / 1609.34 end as dist_miles
    from public.listings l
    join public.vendors v2 on v2.id = l.vendor_id
    where l.is_active and v2.is_active
      and (
        l.search_vector @@ search_query
        or word_similarity(q, lower(coalesce(l.title,'') || ' ' || coalesce(l.category,''))) >= 0.5
      )
      and (
        center is null or v2.location is null
        or st_dwithin(v2.location, center, p_radius_miles * 1609.34)
      )
      and (p_type = 'all' or p_type = 'listings')
      -- Property intent hard-filters to housing types; category intent does not.
      and (not is_property or l.type = any(intent_types))

    union all

    -- ── Vendors (dropped only for property intent) ──
    select
      'vendor'::text, v.id, v.slug, v.business_name, v.category, v.logo_url,
      v.city, v.state, v.rating, v.tier, v.is_verified,
      null::text,
      ts_rank_cd(v.search_vector, search_query),
      (v.search_vector @@ search_query),
      word_similarity(q, lower(coalesce(v.business_name,'') || ' ' || coalesce(v.category,''))),
      case when center is null or v.location is null then null
           else st_distance(v.location, center) / 1609.34 end
    from public.vendors v
    where v.is_active
      and (
        v.search_vector @@ search_query
        or word_similarity(q, lower(coalesce(v.business_name,'') || ' ' || coalesce(v.category,''))) >= 0.5
      )
      and (
        center is null or v.location is null
        or st_dwithin(v.location, center, p_radius_miles * 1609.34)
      )
      and (p_type = 'all' or p_type = 'vendors')
      and not is_property
  )
  select
    m.result_type, m.id, m.slug, m.title, m.subtitle, m.image_url, m.city, m.state,
    m.rating, m.tier, m.is_verified,
    (
      greatest(m.fts_rank, 0) * 4.0                                   -- field-weighted relevance (title ≫ description)
      + case when m.fts_hit then 1.0 else 0.0 end                    -- reward a real full-text hit over trigram-only
      + case when cardinality(intent_types) > 0 and m.ltype = any(intent_types) then 2.0 else 0.0 end  -- intent-type boost
      + coalesce(m.rating, 0) * 0.05                                 -- gentle quality nudge
      + m.trg * 0.5                                                  -- trigram closeness
      -- ── Proximity: nearer within the radius ranks higher ──
      + case when m.dist_miles is null then 0.0
             else greatest(0.0, 1.0 - m.dist_miles / greatest(p_radius_miles, 1)) * 2.5 end
    )::real as rank
  from matches m
  order by rank desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

grant execute on function keyword_search(text, text, text, integer, integer, integer) to anon, authenticated;
