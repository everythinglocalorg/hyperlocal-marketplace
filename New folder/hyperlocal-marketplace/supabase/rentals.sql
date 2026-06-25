-- Rental duration tiers per listing
create table if not exists public.rental_durations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  label text not null,        -- e.g. "Half Day", "Full Day", "Weekend"
  hours numeric not null,     -- duration in hours
  price numeric not null,
  created_at timestamptz default now()
);

-- Customer rental bookings
create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  duration_id uuid references public.rental_durations(id) on delete set null,
  duration_label text not null,
  duration_hours numeric not null,
  total_price numeric not null,
  start_date date not null,
  start_time text not null,   -- e.g. "09:00"
  end_date date,
  status text not null default 'pending', -- pending | confirmed | cancelled | completed
  waiver_signed boolean not null default false,
  waiver_signer_name text,
  waiver_signed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Add waiver_url to listings
alter table public.listings
  add column if not exists waiver_url text,
  add column if not exists waiver_filename text;

-- Indexes
create index if not exists rental_bookings_listing_idx on public.rental_bookings(listing_id);
create index if not exists rental_bookings_vendor_idx on public.rental_bookings(vendor_id);
create index if not exists rental_bookings_customer_idx on public.rental_bookings(customer_id);
create index if not exists rental_bookings_date_idx on public.rental_bookings(start_date);
create index if not exists rental_durations_listing_idx on public.rental_durations(listing_id);

-- RLS
alter table public.rental_durations enable row level security;
alter table public.rental_bookings enable row level security;

create policy "Anyone can view rental durations" on public.rental_durations
  for select using (true);

create policy "Vendors can manage their durations" on public.rental_durations
  for all using (
    exists (select 1 from public.listings l join public.vendors v on v.id = l.vendor_id
            where l.id = listing_id and v.user_id = auth.uid())
  );

create policy "Customers can view their bookings" on public.rental_bookings
  for select using (auth.uid() = customer_id);

create policy "Vendors can view bookings for their listings" on public.rental_bookings
  for select using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

create policy "Authenticated users can create bookings" on public.rental_bookings
  for insert with check (auth.uid() = customer_id);

create policy "Vendors can update booking status" on public.rental_bookings
  for update using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

create policy "Customers can update their own bookings" on public.rental_bookings
  for update using (auth.uid() = customer_id);
