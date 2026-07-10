-- Vendor-defined product categories (sections) — e.g. "Heat & Eat Family Packs",
-- "Party Pack Meals". Vendors create/rename them and assign listings; the public
-- profile shows them as a filter nav over the product grid. Separate from the
-- marketplace `category`/`categories` columns (those power global search).

create table if not exists public.listing_categories (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_listing_categories_vendor on public.listing_categories(vendor_id, position);

alter table public.listings
  add column if not exists listing_category_id uuid references public.listing_categories(id) on delete set null;

alter table public.listing_categories enable row level security;

drop policy if exists "public read listing categories" on public.listing_categories;
create policy "public read listing categories" on public.listing_categories
  for select using (true);

drop policy if exists "vendor manage listing categories" on public.listing_categories;
create policy "vendor manage listing categories" on public.listing_categories
  for all
  using (auth.uid() = (select user_id from public.vendors where id = listing_categories.vendor_id))
  with check (auth.uid() = (select user_id from public.vendors where id = listing_categories.vendor_id));
