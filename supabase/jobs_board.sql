-- ============================================================
-- JOBS BOARD — public per-town job postings with a visibility radius
-- Jobs are posted to a town (city_slug) and carry that town's center
-- coords. radius_miles controls how far out nearby towns can see the
-- job via the jobs_nearby() RPC (modeled on search_vendors_nearby).
-- Run in the Supabase SQL Editor. Requires PostGIS (already enabled).
-- ============================================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  description text not null,
  job_type text not null default 'full_time', -- 'full_time' | 'part_time' | 'gig' | 'contract' | 'seasonal'
  pay_label text,                             -- free text: "$18-22/hr", "DOE"
  contact_email text,
  contact_phone text,
  city text not null,
  state text,
  city_slug text not null,                    -- e.g. "eau-claire-wi"
  latitude double precision,                  -- town center at post time
  longitude double precision,
  radius_miles integer not null default 25,   -- how far nearby towns can see it
  is_active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- Indexes
create index if not exists jobs_city_slug_idx on public.jobs(city_slug);
create index if not exists jobs_created_idx on public.jobs(created_at desc);
create index if not exists jobs_lat_lng_idx on public.jobs(latitude, longitude);

-- RLS (mirrors community_posts)
alter table public.jobs enable row level security;

drop policy if exists "Anyone can view active jobs" on public.jobs;
create policy "Anyone can view active jobs" on public.jobs
  for select using (is_active = true or auth.uid() = user_id);

drop policy if exists "Authenticated users can post jobs" on public.jobs;
create policy "Authenticated users can post jobs" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs" on public.jobs
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own jobs" on public.jobs;
create policy "Users can delete own jobs" on public.jobs
  for delete using (auth.uid() = user_id);

drop policy if exists "Admins can delete any job" on public.jobs;
create policy "Admins can delete any job" on public.jobs
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- jobs_nearby — active jobs visible from a viewer's town center.
-- A job is visible when the viewer's center is within the JOB'S OWN
-- radius_miles of the job's town center (per-job reach, unlike the
-- viewer-radius in search_vendors_nearby). Newest first, with a
-- computed distance_miles.
-- ============================================================
create or replace function jobs_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  vendor_id uuid,
  title text,
  description text,
  job_type text,
  pay_label text,
  contact_email text,
  contact_phone text,
  city text,
  state text,
  city_slug text,
  radius_miles integer,
  is_active boolean,
  created_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision
) as $$
begin
  return query
  select
    j.id,
    j.user_id,
    j.vendor_id,
    j.title,
    j.description,
    j.job_type,
    j.pay_label,
    j.contact_email,
    j.contact_phone,
    j.city,
    j.state,
    j.city_slug,
    j.radius_miles,
    j.is_active,
    j.created_at,
    j.expires_at,
    st_distance(
      st_point(j.longitude, j.latitude)::geography,
      st_point(p_longitude, p_latitude)::geography
    ) / 1609.34 as distance_miles
  from public.jobs j
  where
    j.is_active = true
    and (j.expires_at is null or j.expires_at > now())
    and j.latitude is not null
    and j.longitude is not null
    and st_dwithin(
      st_point(j.longitude, j.latitude)::geography,
      st_point(p_longitude, p_latitude)::geography,
      j.radius_miles * 1609.34
    )
  order by j.created_at desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;
