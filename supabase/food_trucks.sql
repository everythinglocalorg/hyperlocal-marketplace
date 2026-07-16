-- Food Trucks become BUSINESSES, not places.
--
-- Food trucks were seeded as places (type='food_truck'), but they're real
-- businesses: they have menus, they can be claimed, they sell. This moves them
-- onto `vendors` and gives them their own city board at /food-trucks/[city],
-- where $5/mo (the same as a job post) buys a featured spot at the top.
--
-- Every food truck is listed free. Paying only buys placement.

-- 1) Featured placement, mirroring how jobs track their subscription.
alter table public.vendors
  add column if not exists food_truck_featured boolean not null default false,
  add column if not exists food_truck_subscription_id text;

create index if not exists vendors_food_trucks_idx
  on public.vendors (city, state, food_truck_featured)
  where category = 'Food Trucks';

-- 2) Convert each seeded food_truck place into an UNCLAIMED free-tier business
--    page (vendors.user_id stays null until someone claims it — the same shape
--    the vendor-claim flow already expects).
--
--    NOTE: places.zip is null for all of them and vendors.zip_code is NOT NULL.
--    Food trucks are mobile, so the zip is meaningless anyway; we fall back to
--    the city's primary zip. All 15 are Eau Claire (54701).
--
--    The truck's photo becomes the BANNER, not the logo — a photo in a logo slot
--    renders badly in VendorLogo (white bg + object-contain).
insert into public.vendors (
  business_name, slug, category, city, state, zip_code,
  description, address, latitude, longitude, phone, website,
  banner_url, tier, is_active, is_claimed
)
select
  p.name,
  p.slug,
  'Food Trucks',
  p.city,
  p.state,
  coalesce(nullif(p.zip, ''), case when p.city = 'Eau Claire' then '54701' else '00000' end),
  p.description,
  p.address,
  p.latitude,      -- trg_sync_vendor_location fills `location` for radius search
  p.longitude,
  p.phone,
  p.website,
  p.images[1],
  'free',
  p.is_active,
  false
from public.places p
where p.type = 'food_truck'
  and not exists (select 1 from public.vendors v where v.slug = p.slug);

-- 3) Point the old place row at its new business page.
--    Only where it isn't already linked — "Island Vibe Food Truck" is already
--    pointed at the Everything Local vendor, which looks like a stray test link.
--    That's left alone rather than silently overwritten; fix it by hand if it's
--    wrong (see the note in the PR/summary).
update public.places p
set vendor_id = v.id,
    updated_at = now()
from public.vendors v
where p.type = 'food_truck'
  and v.slug = p.slug
  and p.vendor_id is null;

-- 4) Retire the place rows from Explore — food trucks live on their own board
--    now. The rows are kept (not deleted) so /places/<slug> links already out in
--    the wild still resolve.
update public.places
set is_active = false, updated_at = now()
where type = 'food_truck';
