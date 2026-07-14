-- ============================================================
-- Rental System Enhancements
-- Builds on supabase/rentals.sql (rental_durations, rental_bookings,
-- listings.waiver_url / waiver_filename must already exist).
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Fully idempotent — safe to re-run.
-- ============================================================

-- ── Listing-level rental controls (Phase 1 & 3 & 4) ─────────
alter table public.listings
  add column if not exists rental_mode text not null default 'hourly',   -- 'hourly' | 'daily'
  add column if not exists rental_buffer_hours numeric not null default 0, -- turnaround/cleaning block after each booking
  add column if not exists rental_quantity int not null default 1,         -- number of identical units available
  add column if not exists waiver_body text,                               -- vendor-pasted waiver text (alt to waiver_url PDF)
  add column if not exists fareharbor_shortname text,                      -- Phase 4 (optional per-vendor embed)
  add column if not exists fareharbor_flow text,
  add column if not exists rental_deposit_type text not null default 'none', -- 'none' | 'percent' | 'full'
  add column if not exists rental_deposit_value numeric not null default 0;   -- percent when type = 'percent'

-- ── Extra signed-waiver + payment columns on bookings ───────
alter table public.rental_bookings
  add column if not exists waiver_signature_url text,  -- captured signature PNG (Phase 2)
  add column if not exists signed_waiver_pdf_url text, -- generated flattened PDF (Phase 2)
  add column if not exists waiver_ip text,
  add column if not exists waiver_user_agent text,
  add column if not exists deposit_amount numeric,                          -- amount charged via Stripe (Payments)
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_payment_intent text,
  add column if not exists payment_status text not null default 'unpaid';   -- 'unpaid' | 'deposit_paid' | 'paid'

-- ── Vendor blackout dates (Phase 3) ─────────────────────────
create table if not exists public.rental_blackouts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  date date not null,
  reason text,
  created_at timestamptz default now(),
  unique (listing_id, date)
);

create index if not exists rental_blackouts_listing_idx on public.rental_blackouts(listing_id);

alter table public.rental_blackouts enable row level security;

-- Availability (blackout dates) is public, non-PII information.
drop policy if exists "Anyone can view blackouts" on public.rental_blackouts;
create policy "Anyone can view blackouts" on public.rental_blackouts
  for select using (true);

drop policy if exists "Vendors manage their blackouts" on public.rental_blackouts;
create policy "Vendors manage their blackouts" on public.rental_blackouts
  for all using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  );

-- ============================================================
-- get_rental_unavailable_dates(listing, from, to)
-- Returns every day in [from, to] that is unavailable — either a
-- vendor blackout OR fully booked (concurrent pending/confirmed
-- bookings >= rental_quantity, honouring the buffer/turnaround).
-- SECURITY DEFINER so customers can see occupancy WITHOUT exposing
-- other customers' booking rows (no PII leaks through RLS).
-- ============================================================
create or replace function public.get_rental_unavailable_dates(
  p_listing_id uuid,
  p_from date,
  p_to date
) returns setof date
language sql
security definer
set search_path = public
stable
as $$
  with l as (
    select coalesce(rental_quantity, 1) as q,
           coalesce(rental_buffer_hours, 0) as bh
    from public.listings where id = p_listing_id
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  )
  select days.d
  from days
  where exists (
          select 1 from public.rental_blackouts b
          where b.listing_id = p_listing_id and b.date = days.d
        )
     or (
          select count(*) from public.rental_bookings rb, l
          where rb.listing_id = p_listing_id
            and rb.status in ('pending', 'confirmed')
            and days.d between rb.start_date
                and (coalesce(rb.end_date, rb.start_date)
                     + (ceil((select bh from l) / 24.0)::int || ' days')::interval)::date
        ) >= (select q from l);
$$;

grant execute on function public.get_rental_unavailable_dates(uuid, date, date) to anon, authenticated;

-- ============================================================
-- create_rental_booking(...)
-- Race-safe booking insert. Takes a per-listing advisory lock,
-- re-validates availability server-side (blackouts + quantity +
-- buffer) for every requested day, then inserts. Raises
-- 'DATE_UNAVAILABLE:<day>' if any requested day is taken so two
-- customers cannot grab the same slot in a race.
-- Returns the new booking id.
-- ============================================================
create or replace function public.create_rental_booking(
  p_listing_id uuid,
  p_duration_id uuid,
  p_duration_label text,
  p_duration_hours numeric,
  p_total_price numeric,
  p_start_date date,
  p_start_time text,
  p_end_date date,
  p_notes text,
  p_waiver_signer_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_quantity int;
  v_buffer_hours numeric;
  v_buffer_days int;
  v_customer uuid := auth.uid();
  v_end date := coalesce(p_end_date, p_start_date);
  v_day date;
  v_booking_id uuid;
begin
  if v_customer is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select l.vendor_id, coalesce(l.rental_quantity, 1), coalesce(l.rental_buffer_hours, 0)
    into v_vendor_id, v_quantity, v_buffer_hours
  from public.listings l
  where l.id = p_listing_id;

  if v_vendor_id is null then
    raise exception 'LISTING_NOT_FOUND';
  end if;

  v_buffer_days := ceil(v_buffer_hours / 24.0)::int;

  -- Serialize concurrent bookings for this listing (auto-released at tx end)
  perform pg_advisory_xact_lock(hashtext(p_listing_id::text));

  v_day := p_start_date;
  while v_day <= v_end loop
    if exists (
      select 1 from public.rental_blackouts b
      where b.listing_id = p_listing_id and b.date = v_day
    ) then
      raise exception 'DATE_UNAVAILABLE:%', v_day;
    end if;

    if (
      select count(*) from public.rental_bookings rb
      where rb.listing_id = p_listing_id
        and rb.status in ('pending', 'confirmed')
        and v_day between rb.start_date
            and (coalesce(rb.end_date, rb.start_date)
                 + (v_buffer_days || ' days')::interval)::date
    ) >= v_quantity then
      raise exception 'DATE_UNAVAILABLE:%', v_day;
    end if;

    v_day := v_day + 1;
  end loop;

  insert into public.rental_bookings (
    listing_id, vendor_id, customer_id, duration_id, duration_label, duration_hours,
    total_price, start_date, start_time, end_date, status,
    waiver_signed, waiver_signer_name, waiver_signed_at, notes
  ) values (
    p_listing_id, v_vendor_id, v_customer, p_duration_id, p_duration_label, p_duration_hours,
    p_total_price, p_start_date, p_start_time, v_end, 'pending',
    true, p_waiver_signer_name, now(), p_notes
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

grant execute on function public.create_rental_booking(uuid, uuid, text, numeric, numeric, date, text, date, text, text) to authenticated;

-- ============================================================
-- Private storage bucket for generated signed waiver PDFs +
-- signature images. Written server-side with the service role;
-- read back via short-lived signed URLs. No public policy.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('rental-waivers', 'rental-waivers', false)
on conflict do nothing;
