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

// How a truck takes orders when it's live. "internal" = our built-in pickup
// tickets (FoodOrderModal → kitchen board); "external" = send customers to the
// truck's own ordering link (Square, Toast, a Google form, etc.).
export type OrderingMode = "internal" | "external";
export type TruckOrdering = { mode: OrderingMode; url: string };

export type FoodTruck = {
  status: TruckStatus;
  spot: TruckSpot;
  live_at: string | null;        // ISO timestamp of the last go-live
  schedule: TruckStop[];
  ordering: TruckOrdering;
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
  return { status: "closed", spot: { name: "", until: "", lat: null, lng: null }, live_at: null, schedule: [], ordering: { mode: "internal", url: "" } };
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
  const o = (t.ordering ?? {}) as Partial<TruckOrdering>;
  const ordering: TruckOrdering = {
    mode: o.mode === "external" ? "external" : "internal",
    url: typeof o.url === "string" ? o.url : "",
  };
  return { status, spot, live_at: typeof t.live_at === "string" ? t.live_at : null, schedule, ordering };
}

export function isLive(ft: FoodTruck): boolean {
  return ft.status === "open" || ft.status === "enroute";
}

// The external ordering link to send customers to, or null when we should use
// our internal pickup tickets. Only meaningful once the truck is taking orders.
export function externalOrderUrl(ft: FoodTruck): string | null {
  if (ft.ordering.mode !== "external") return null;
  const url = ft.ordering.url.trim();
  return url ? url : null;
}

// ── Pickup orders (Phase 2) ─────────────────────────────────────────────

export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";

export type OrderItem = { listing_id: string; title: string; qty: number; price: number };

export type FoodOrder = {
  id: string;
  vendor_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: OrderItem[];
  total: number;
  pickup_spot: string | null;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  ready_at: string | null;
};

// The kitchen flow: New → Preparing → Ready (order up!) → Completed.
export const ORDER_STATUS_META: Record<OrderStatus, {
  label: string; badge: string; next?: OrderStatus; nextLabel?: string;
}> = {
  new:        { label: "New",        badge: "bg-blue-100 text-blue-700",   next: "preparing", nextLabel: "Start" },
  preparing:  { label: "Preparing",  badge: "bg-amber-100 text-amber-700", next: "ready",     nextLabel: "🔔 Order up!" },
  ready:      { label: "Ready",      badge: "bg-green-100 text-green-700", next: "completed", nextLabel: "Picked up ✓" },
  completed:  { label: "Completed",  badge: "bg-gray-100 text-gray-500" },
  cancelled:  { label: "Cancelled",  badge: "bg-red-100 text-red-500" },
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

export function orderTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
}

// Ordered schedule starting from today's weekday, for "next stop" display.
export function upcomingStops(ft: FoodTruck): TruckStop[] {
  if (ft.schedule.length === 0) return [];
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  const order = (d: string) => (DAYS.indexOf(d as (typeof DAYS)[number]) - todayIdx + 7) % 7;
  return [...ft.schedule].sort((a, b) => order(a.day) - order(b.day));
}
