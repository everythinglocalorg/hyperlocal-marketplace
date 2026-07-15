-- Keep the PostGIS `location` (geography) column in sync with latitude/longitude
-- automatically. Previously nothing synced them, so radius search and the map
-- could drift apart. Now any lat/lng write (backfill, onboarding, Store Settings
-- geocode) updates `location` too.

create or replace function sync_vendor_location() returns trigger as $$
begin
  if NEW.latitude is not null and NEW.longitude is not null then
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_vendor_location on public.vendors;
create trigger trg_sync_vendor_location
  before insert or update of latitude, longitude on public.vendors
  for each row execute function sync_vendor_location();
