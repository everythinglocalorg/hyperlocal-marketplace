-- Allow admins to delete vendors and their listings.
-- Without these policies, a client-side delete() is silently blocked by RLS
-- (0 rows deleted, no error), so the admin "Delete" action appeared to work
-- but the business reappeared on refresh.

drop policy if exists "Admins can delete any vendor" on public.vendors;
create policy "Admins can delete any vendor" on public.vendors
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can delete any listing" on public.listings;
create policy "Admins can delete any listing" on public.listings
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
