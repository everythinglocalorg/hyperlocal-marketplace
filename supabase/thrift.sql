-- ─── Thrift Sales experience ────────────────────────────────────────────────
-- Adds "sold" state to listings and a buyer↔vendor offer/negotiation table.
-- Idempotent: safe to re-run.

-- 1. Sold state for one-of-a-kind thrift items
alter table public.listings
  add column if not exists sold_at timestamptz;

create index if not exists listings_sold_at_idx on public.listings(sold_at);

-- 2. Offers / negotiation on thrift listings
create table if not exists public.thrift_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  amount numeric not null,
  message text,
  status text not null default 'pending',   -- pending | accepted | declined | countered
  counter_amount numeric,
  listing_title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists thrift_offers_listing_idx on public.thrift_offers(listing_id);
create index if not exists thrift_offers_vendor_idx on public.thrift_offers(vendor_id);
create index if not exists thrift_offers_buyer_idx on public.thrift_offers(buyer_id);
create index if not exists thrift_offers_status_idx on public.thrift_offers(status);

alter table public.thrift_offers enable row level security;

-- Anyone (incl. guests) can make an offer; buyer_id may be null for guests.
drop policy if exists "Anyone can create an offer" on public.thrift_offers;
create policy "Anyone can create an offer" on public.thrift_offers
  for insert with check (true);

-- Buyers see their own offers; vendors see offers on their listings.
drop policy if exists "Buyer sees own offers" on public.thrift_offers;
create policy "Buyer sees own offers" on public.thrift_offers
  for select using (auth.uid() = buyer_id);

drop policy if exists "Vendor sees offers on their listings" on public.thrift_offers;
create policy "Vendor sees offers on their listings" on public.thrift_offers
  for select using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

-- Vendors accept / decline / counter their listings' offers.
drop policy if exists "Vendor updates offers on their listings" on public.thrift_offers;
create policy "Vendor updates offers on their listings" on public.thrift_offers
  for update using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

grant select, insert, update on public.thrift_offers to anon, authenticated;
