-- Auto-seed a few starter Places for every town so the Explore tab is never
-- empty. Each town gets a City Park (park), Downtown (attraction), and a
-- Farmers Market (thing to do). Fires on any new row in `cities`, and we
-- backfill existing sparse towns below. Starter entries can be edited/claimed.

create or replace function seed_places_for_town(p_slug text)
returns void as $$
declare
  ct record;
  cby uuid := 'dce5f5cf-18ae-46ee-b994-ba5d2249a2c2'; -- system author (admin)
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
     array['https://images.unsplash.com/photo-1668009219418-4ece0d9e36c4?w=1200&q=80'],
     array['park','family','outdoors'], '{}', array['walking','picnics','playground'],
     'Free', cby, false, true),
    (ct.slug || '-downtown', 'Downtown ' || ct.city, 'attraction', 'Historic Downtown',
     'Explore downtown ' || ct.city || ' — local shops, cafes, and small-town charm.',
     ct.city, ct.state, ct.slug, ct.latitude, ct.longitude,
     array['https://images.unsplash.com/photo-1570933657058-401caa810e60?w=1200&q=80'],
     array['downtown','shopping','local'], '{}', array['shopping','dining','sightseeing'],
     'Free', cby, false, true),
    (ct.slug || '-farmers-market', ct.city || ' Farmers Market', 'thing_to_do', 'Farmers Market',
     'Seasonal farmers market in ' || ct.city || ' — fresh produce, baked goods, and local makers.',
     ct.city, ct.state, ct.slug, ct.latitude, ct.longitude,
     array['https://images.unsplash.com/photo-1485637701894-09ad422f6de6?w=1200&q=80'],
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
