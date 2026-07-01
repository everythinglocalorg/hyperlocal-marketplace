// Backfill latitude/longitude/location for vendors that don't have coordinates.
// Geocodes each vendor's "address, city, state" (or "city, state") via the free
// OpenStreetMap Nominatim service, then writes lat/lng and the PostGIS location
// POINT so search_vendors_nearby can find them.
//
// Usage: node scripts/backfill-geocode.mjs [--force]
//   --force  re-geocode every vendor, even ones that already have coords.
//
// Nominatim asks for <=1 request/sec, so this sleeps 1.1s between calls.
import { readFileSync } from "node:fs";
import { Client } from "pg";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en-US", "User-Agent": "EverythingLocalMarketplace/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  loadEnv();
  const force = process.argv.includes("--force");
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set in .env.local"); process.exit(1); }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows } = await client.query(
    force
      ? `select id, business_name, address, city, state from public.vendors`
      : `select id, business_name, address, city, state from public.vendors
         where location is null or latitude is null or longitude is null`
  );

  console.log(`${rows.length} vendor(s) to geocode${force ? " (forced)" : ""}.`);
  let ok = 0, skip = 0, fail = 0;

  for (const v of rows) {
    const parts = [v.address, v.city, v.state].filter(Boolean);
    if (parts.length === 0) { console.log(`— ${v.business_name}: no location data, skipping`); skip++; continue; }
    const query = parts.join(", ");

    let geo = await geocode(query);
    // Fall back to city + state if the full address didn't resolve
    if (!geo && v.address) geo = await geocode([v.city, v.state].filter(Boolean).join(", "));

    if (!geo) { console.log(`✗ ${v.business_name} (${query}): not found`); fail++; await sleep(1100); continue; }

    await client.query(
      `update public.vendors
       set latitude = $1, longitude = $2, location = st_setsrid(st_point($2, $1), 4326)::geography
       where id = $3`,
      [geo.lat, geo.lng, v.id]
    );
    console.log(`✓ ${v.business_name}: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`);
    ok++;
    await sleep(1100);
  }

  await client.end();
  console.log(`\nDone. ${ok} updated, ${skip} skipped, ${fail} failed.`);
}

main().catch((e) => { console.error("Backfill failed:", e.message); process.exit(1); });
