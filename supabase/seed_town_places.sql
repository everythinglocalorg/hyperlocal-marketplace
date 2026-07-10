-- Auto-seed a few starter Places for every town so the Explore tab is never
-- empty. Each town gets a City Park (park), Downtown (attraction), and a
-- Farmers Market (thing to do). Fires on any new row in `cities`, and we
-- backfill existing sparse towns below. Starter entries can be edited/claimed.

create or replace function seed_places_for_town(p_slug text)
returns void as $$
declare
  ct record;
  cby uuid := 'dce5f5cf-18ae-46ee-b994-ba5d2249a2c2'; -- system author (admin)
  -- Verified photo pools; each new town draws a random one per type so towns
  -- don't all share the same starter image. (A town's real local photos can be
  -- swapped in afterward — see the Wikipedia town images used for launch towns.)
  parks text[] := array[
    '1668009219418-4ece0d9e36c4','1561133211-6067fc8e7348','1615373111465-965023eb989c',
    '1629735053270-f674b9359fe1','1752542585106-f6ad640304d7','1622050956578-94fd044a0ada'];
  streets text[] := array['1570933657058-401caa810e60','1557418223-39e7931d52af'];
  markets text[] := array[
    '1485637701894-09ad422f6de6','1526399743290-f73cb4022f48','1567306295427-94503f8300d7',
    '1506484381205-f7945653044d','1645976442233-bcf005876613','1576181456177-2b99ac0aa1ef',
    '1589483233144-795633bf597c','1559454473-66f2d4f5a725','1651346846962-713719196b8d',
    '1687199129802-3e4cc27baac0'];
  base text := 'https://images.unsplash.com/photo-';
  suf  text := '?w=1200&q=80';
begin
  select * into ct from public.cities where slug = p_slug;
  if not found then return; end if;

  -- `location` is a generated column (derived from lat/lng), so it is omitted.
  insert into public.places
    (slug, name, type, subtype, description, city, state, city_slug,
     latitude, longitude, images, tags, amenities, activities,
     fees, created_by, is_claimed, is_active)
  values
    (ct.slug || '-city-park', ct.city || ' City Park', 'park', 'City Park',
     'A local park in ' || ct.city || ' — green space for picnics, the playground, and an easy stroll.',
     ct.city, ct.state, ct.slug, ct.latitude, ct.longitude,
     array[base || parks[1 + floor(random() * array_length(parks,1))::int] || suf],
     array['park','family','outdoors'], '{}', array['walking','picnics','playground'],
     'Free', cby, false, true),
    (ct.slug || '-downtown', 'Downtown ' || ct.city, 'attraction', 'Historic Downtown',
     'Explore downtown ' || ct.city || ' — local shops, cafes, and small-town charm.',
     ct.city, ct.state, ct.slug, ct.latitude, ct.longitude,
     array[base || streets[1 + floor(random() * array_length(streets,1))::int] || suf],
     array['downtown','shopping','local'], '{}', array['shopping','dining','sightseeing'],
     'Free', cby, false, true),
    (ct.slug || '-farmers-market', ct.city || ' Farmers Market', 'thing_to_do', 'Farmers Market',
     'Seasonal farmers market in ' || ct.city || ' — fresh produce, baked goods, and local makers.',
     ct.city, ct.state, ct.slug, ct.latitude, ct.longitude,
     array[base || markets[1 + floor(random() * array_length(markets,1))::int] || suf],
     array['market','local','seasonal'], '{}', array['shopping','food','community'],
     'Free', cby, false, true)
  on conflict (slug) do nothing;
end;
$$ language plpgsql security definer;

create or replace function seed_town_places()
returns trigger as $$
begin
  perform seed_places_for_town(new.slug);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists cities_seed_places on public.cities;
create trigger cities_seed_places
  after insert on public.cities
  for each row execute function seed_town_places();

-- Backfill existing towns that have few/no Places of their own.
select seed_places_for_town('northfield-mn');
select seed_places_for_town('cannon-falls-mn');
select seed_places_for_town('mondovi-wi');

-- Add the new towns (the trigger auto-seeds their starter Places).
insert into public.cities (slug, city, state, latitude, longitude) values
  ('fall-creek-wi', 'Fall Creek', 'WI', 44.7636, -91.2771),
  ('eleva-wi',      'Eleva',      'WI', 44.5758, -91.4702),
  ('durand-wi',     'Durand',     'WI', 44.6284, -91.9677),
  ('rice-lake-wi',  'Rice Lake',  'WI', 45.5028, -91.7334),
  ('arcadia-wi',    'Arcadia',    'WI', 44.2527, -91.5015),
  ('osseo-wi',      'Osseo',      'WI', 44.5773, -91.2228),
  ('marshfield-wi', 'Marshfield', 'WI', 44.6662, -90.1740)
on conflict (slug) do nothing;
