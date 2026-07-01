export const CITIES = [
  { slug: 'eau-claire-wi', label: 'Eau Claire, WI', city: 'Eau Claire', state: 'WI', zip: '54701', latitude: 44.8113, longitude: -91.4985 },
  { slug: 'faribault-mn', label: 'Faribault, MN',  city: 'Faribault',  state: 'MN', zip: '55021', latitude: 44.2955, longitude: -93.2688 },
];

export type CityOption = typeof CITIES[0];

export function cityFromSlug(slug: string): CityOption | undefined {
  return CITIES.find(c => c.slug === slug);
}

export const DEFAULT_CITY_SLUG = 'eau-claire-wi';
export const LS_CITY_KEY = 'el_city';
