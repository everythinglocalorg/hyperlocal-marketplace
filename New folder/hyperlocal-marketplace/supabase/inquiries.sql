create table if not exists public.purchase_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  vendor_id uuid references public.vendors(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  message text,
  inquiry_type text not null default 'buy', -- 'buy' | 'book'
  listing_title text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists purchase_inquiries_vendor_idx on public.purchase_inquiries(vendor_id);
create index if not exists purchase_inquiries_listing_idx on public.purchase_inquiries(listing_id);
create index if not exists purchase_inquiries_read_idx on public.purchase_inquiries(vendor_id, is_read);

alter table public.purchase_inquiries enable row level security;

create policy "Vendors can view their inquiries" on public.purchase_inquiries
  for select using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

create policy "Vendors can update their inquiries" on public.purchase_inquiries
  for update using (
    exists (select 1 from public.vendors where id = vendor_id and user_id = auth.uid())
  );

create policy "Anyone can create an inquiry" on public.purchase_inquiries
  for insert with check (true);
