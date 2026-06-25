-- ============================================================
-- Full-Text Search — Run this AFTER schema.sql
-- Enables keyword search like "plumber", "italian food", "fresh eggs"
-- ============================================================

-- Add search vector columns
alter table public.vendors
  add column if not exists search_vector tsvector;

alter table public.listings
  add column if not exists search_vector tsvector;

-- GIN indexes for fast full-text search
create index if not exists vendors_search_idx on public.vendors using gin(search_vector);
create index if not exists listings_search_idx on public.listings using gin(search_vector);

-- ============================================================
-- AUTO-UPDATE vendor search vector when row changes
-- Combines: business name (highest weight), category, description, city, tags
-- ============================================================
create or replace function update_vendor_search_vector()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.business_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.city, '') || ' ' || coalesce(new.state, '')), 'D');
  return new;
end;
$$ language plpgsql;

create trigger vendors_search_vector_update
  before insert or update on public.vendors
  for each row execute function update_vendor_search_vector();

-- ============================================================
-- AUTO-UPDATE listing search vector when row changes
-- Combines: title (highest weight), tags, category, description
-- ============================================================
create or replace function update_listing_search_vector()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$ language plpgsql;

create trigger listings_search_vector_update
  before insert or update on public.listings
  for each row execute function update_listing_search_vector();

-- ============================================================
-- KEYWORD SEARCH FUNCTION
-- Searches vendors + listings by keyword, optionally filtered by city
-- Returns unified results ranked by relevance
-- ============================================================
create or replace function keyword_search(
  p_query text,
  p_city_slug text default null,   -- e.g. 'eau-claire-wi'
  p_type text default 'all',       -- 'vendors', 'listings', or 'all'
  p_limit integer default 20,
  p_offset integer default 0
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
  p_city text;
  p_state text;
begin
  -- Parse city slug into city/state (e.g. 'eau-claire-wi' → 'Eau Claire', 'WI')
  if p_city_slug = 'eau-claire-wi' then
    p_city := 'Eau Claire'; p_state := 'WI';
  elsif p_city_slug = 'faribault-mn' then
    p_city := 'Faribault'; p_state := 'MN';
  else
    p_city := null; p_state := null;
  end if;

  -- Build tsquery: supports multi-word phrases, falls back to prefix match
  search_query := websearch_to_tsquery('english', p_query);

  return query
  -- Vendor results
  select
    'vendor'::text,
    v.id,
    v.slug,
    v.business_name,
    v.category,
    v.logo_url,
    v.city,
    v.state,
    v.rating,
    v.tier,
    v.is_verified,
    ts_rank(v.search_vector, search_query) as rank
  from public.vendors v
  where
    v.is_active = true
    and v.search_vector @@ search_query
    and (p_city is null or (v.city = p_city and v.state = p_state))
    and (p_type = 'all' or p_type = 'vendors')

  union all

  -- Listing results (slug = vendor slug so we can link to vendor profile)
  select
    'listing'::text,
    l.id,
    v2.slug,
    l.title,
    l.category,
    l.images[1],
    v2.city,
    v2.state,
    v2.rating,
    v2.tier,
    v2.is_verified,
    ts_rank(l.search_vector, search_query) as rank
  from public.listings l
  join public.vendors v2 on v2.id = l.vendor_id
  where
    l.is_active = true
    and v2.is_active = true
    and l.search_vector @@ search_query
    and (p_city is null or (v2.city = p_city and v2.state = p_state))
    and (p_type = 'all' or p_type = 'listings')

  order by rank desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;
