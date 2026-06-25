-- ============================================================
-- Supabase Storage Buckets
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Vendor logos (square profile photo)
insert into storage.buckets (id, name, public)
values ('vendor-logos', 'vendor-logos', true)
on conflict do nothing;

-- Vendor banners (cover/hero photo)
insert into storage.buckets (id, name, public)
values ('vendor-banners', 'vendor-banners', true)
on conflict do nothing;

-- Listing images
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict do nothing;

-- Storage policies — anyone can read, only owner can upload
create policy "Public can read vendor logos" on storage.objects
  for select using (bucket_id = 'vendor-logos');

create policy "Authenticated users can upload vendor logos" on storage.objects
  for insert with check (
    bucket_id = 'vendor-logos' and auth.role() = 'authenticated'
  );

create policy "Owner can update vendor logos" on storage.objects
  for update using (
    bucket_id = 'vendor-logos' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Owner can delete vendor logos" on storage.objects
  for delete using (
    bucket_id = 'vendor-logos' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public can read vendor banners" on storage.objects
  for select using (bucket_id = 'vendor-banners');

create policy "Authenticated users can upload vendor banners" on storage.objects
  for insert with check (
    bucket_id = 'vendor-banners' and auth.role() = 'authenticated'
  );

create policy "Owner can update vendor banners" on storage.objects
  for update using (
    bucket_id = 'vendor-banners' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Owner can delete vendor banners" on storage.objects
  for delete using (
    bucket_id = 'vendor-banners' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Public can read listing images" on storage.objects
  for select using (bucket_id = 'listing-images');

create policy "Authenticated users can upload listing images" on storage.objects
  for insert with check (
    bucket_id = 'listing-images' and auth.role() = 'authenticated'
  );

create policy "Owner can delete listing images" on storage.objects
  for delete using (
    bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
