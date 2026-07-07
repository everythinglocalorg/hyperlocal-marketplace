-- Let admins edit any vendor/listing from the dashboard admin tabs
-- (All Businesses tier changes, All Listings CTA button changes). Without these,
-- a client-side update() is silently blocked by RLS (0 rows, no error).

drop policy if exists "Admins can update any vendor" on public.vendors;
create policy "Admins can update any vendor" on public.vendors
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can update any listing" on public.listings;
create policy "Admins can update any listing" on public.listings
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
