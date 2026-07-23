// Food-truck "Go Live" status + weekly schedule. Stored per-vendor in
// vendors.food_truck (jsonb). Only meaningful for category "Food Trucks".

export const FOOD_TRUCK_CATEGORY = "Food Trucks";

export type TruckStatus = "closed" | "open" | "enroute";

export type TruckSpot = {
  name: string;
  until: string;                 // free text, e.g. "8:00 PM"
  lat: number | null;
  lng: number | null;
};

export type TruckStop = {
  id: string;
  day: string;                   // Mon..Sun
  label: string;                 // place name
  start: string;                 // "11:00 AM"
  end: string;                   // "2:00 PM"
};

export type FoodTruck = {
  status: TruckStatus;
  spot: TruckSpot;
  live_at: string | null;        // ISO timestamp of the last go-live
  schedule: TruckStop[];
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const TRUCK_STATUS_META: Record<TruckStatus, { label: string; dot: string; text: string }> = {
  open:    { label: "Open now", dot: "#15803d", text: "text-green-700" },
  enroute: { label: "On the way", dot: "#d97706", text: "text-amber-600" },
  closed:  { label: "Closed",   dot: "#9ca3af", text: "text-gray-400" },
};

export function isFoodTruck(category?: string | null): boolean {
  return category === FOOD_TRUCK_CATEGORY;
}

export function emptyFoodTruck(): FoodTruck {
  return { status: "closed", spot: { name: "", until: "", lat: null, lng: null }, live_at: null, schedule: [] };
}

// Normalize a raw vendors.food_truck value into a safe FoodTruck.
export function normalizeFoodTruck(raw: unknown): FoodTruck {
  const t = (raw ?? {}) as Partial<FoodTruck>;
  const status: TruckStatus = t.status === "open" || t.status === "enroute" ? t.status : "closed";
  const s = (t.spot ?? {}) as Partial<TruckSpot>;
  const spot: TruckSpot = {
    name: typeof s.name === "string" ? s.name : "",
    until: typeof s.until === "string" ? s.until : "",
    lat: typeof s.lat === "number" ? s.lat : null,
    lng: typeof s.lng === "number" ? s.lng : null,
  };
  const schedule: TruckStop[] = Array.isArray(t.schedule)
    ? t.schedule.filter((x): x is TruckStop => !!x && typeof x === "object")
    : [];
  return { status, spot, live_at: typeof t.live_at === "string" ? t.live_at : null, schedule };
}

export function isLive(ft: FoodTruck): boolean {
  return ft.status === "open" || ft.status === "enroute";
}

// Ordered schedule starting from today's weekday, for "next stop" display.
export function upcomingStops(ft: FoodTruck): TruckStop[] {
  if (ft.schedule.length === 0) return [];
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  const order = (d: string) => (DAYS.indexOf(d as (typeof DAYS)[number]) - todayIdx + 7) % 7;
  return [...ft.schedule].sort((a, b) => order(a.day) - order(b.day));
}
