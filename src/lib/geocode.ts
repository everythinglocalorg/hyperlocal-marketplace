// Free geocoding via OpenStreetMap Nominatim — no API key required

export interface GeoResult {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

export async function geocodeQuery(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en-US", "User-Agent": "Everything LocalMarketplace/1.0" },
    });
    const data = await res.json();
    if (!data?.length) return null;

    const r = data[0];
    const addr = r.address;
    return {
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? "",
      state: addr.state ?? "",
      country: addr.country_code?.toUpperCase() ?? "US",
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      displayName: `${addr.city ?? addr.town ?? addr.village ?? addr.county ?? ""}, ${addr.state ?? ""}`,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en-US", "User-Agent": "Everything LocalMarketplace/1.0" },
    });
    const data = await res.json();
    if (!data?.address) return null;

    const addr = data.address;
    return {
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? "",
      state: addr.state ?? "",
      country: addr.country_code?.toUpperCase() ?? "US",
      latitude: lat,
      longitude: lon,
      displayName: `${addr.city ?? addr.town ?? addr.village ?? addr.county ?? ""}, ${addr.state ?? ""}`,
    };
  } catch {
    return null;
  }
}

export function getBrowserLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}
