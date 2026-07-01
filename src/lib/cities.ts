export type CityOption = {
  slug: string;
  label: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  zip?: string;
};

export const SEED_CITIES: CityOption[] = [
  { slug: 'eau-claire-wi', label: 'Eau Claire, WI', city: 'Eau Claire', state: 'WI', zip: '54701', latitude: 44.8113, longitude: -91.4985 },
  { slug: 'faribault-mn', label: 'Faribault, MN',  city: 'Faribault',  state: 'MN', zip: '55021', latitude: 44.2955, longitude: -93.2688 },
];

// Keep CITIES as alias so existing imports still work
export const CITIES = SEED_CITIES;

export function makeSlug(city: string, state: string): string {
  return `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${state.toLowerCase()}`;
}

export function cityFromSlug(slug: string): CityOption | undefined {
  return SEED_CITIES.find(c => c.slug === slug);
}

// Resolve a slug to a CityOption. Falls back to parsing the slug itself
// (e.g. 'northfield-mn' -> city 'Northfield', state 'MN') for non-seed cities,
// so filtering works without a DB round-trip.
export function resolveCity(slug: string): CityOption | undefined {
  if (!slug) return undefined;
  const seed = cityFromSlug(slug);
  if (seed) return seed;

  const lastDash = slug.lastIndexOf('-');
  if (lastDash === -1) return undefined;
  const stateSlug = slug.slice(lastDash + 1);
  const citySlugPart = slug.slice(0, lastDash);
  if (!stateSlug || !citySlugPart) return undefined;

  const state = stateSlug.toUpperCase();
  const city = citySlugPart
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { slug, label: `${city}, ${state}`, city, state };
}

export const DEFAULT_CITY_SLUG = 'eau-claire-wi';
export const LS_CITY_KEY = 'el_city';

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export function normalizeState(s: string): string {
  if (s.length === 2) return s.toUpperCase();
  return STATE_ABBR[s.toLowerCase()] ?? s.toUpperCase();
}

export type CityCenter = { latitude: number; longitude: number };

// Resolve a city's center coordinates for radius search.
// Seed cities return instantly; others hit the cached /api/cities/resolve route.
export async function fetchCityCenter(city: CityOption): Promise<CityCenter | null> {
  const seed = cityFromSlug(city.slug);
  if (seed?.latitude != null && seed?.longitude != null) {
    return { latitude: seed.latitude, longitude: seed.longitude };
  }
  try {
    const params = new URLSearchParams({ slug: city.slug, city: city.city, state: city.state });
    const res = await fetch(`/api/cities/resolve?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.latitude != null && data?.longitude != null) {
      return { latitude: data.latitude, longitude: data.longitude };
    }
  } catch { /* fall through */ }
  return null;
}

// Great-circle distance in miles between two lat/lng points.
export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
