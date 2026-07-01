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

export const DEFAULT_CITY_SLUG = 'eau-claire-wi';
export const LS_CITY_KEY = 'el_city';
