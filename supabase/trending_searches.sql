-- ============================================================
-- Everything Local — Ask Mike: location-aware trending searches
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Depends on: analytics_events.sql (the search event stream)
--
-- Powers the suggestion chips under every search box. Trending in
-- Phoenix, AZ is computed independently from Eau Claire, WI because we
-- group by city_context (the analytics city slug, e.g. "phoenix-az").
--
-- Privacy: SECURITY DEFINER so it can read the admin-only event table,
-- but it only ever returns aggregated terms that (a) at least 2 distinct
-- sessions searched and (b) actually returned results — never a single
-- person's one-off query, never a dead-end term.
-- ============================================================

-- Speeds up the per-city, recent-window aggregation.
create index if not exists analytics_events_search_city_created_idx
  on public.analytics_events (city_context, created_at desc)
  where event_type = 'search';

create or replace function public.trending_searches(
  p_city text default null,
  p_limit int default 10
)
returns table (term text, searches bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    lower(trim(event_data->>'query')) as term,
    count(*) as searches
  from public.analytics_events
  where event_type = 'search'
    and created_at > now() - interval '30 days'
    and coalesce(trim(event_data->>'query'), '') <> ''
    and left(trim(event_data->>'query'), 1) <> '@'
    and char_length(trim(event_data->>'query')) between 2 and 40
    and coalesce((event_data->>'zero_results')::boolean, false) = false
    and (p_city is null or city_context = p_city)
  group by 1
  having count(distinct session_id) >= 2
  order by searches desc, max(created_at) desc
  limit least(greatest(p_limit, 1), 20);
$$;

-- Callable by the public suggestions API (anon key) and logged-in users.
grant execute on function public.trending_searches(text, int) to anon, authenticated;
