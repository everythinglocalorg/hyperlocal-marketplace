export type FeatureKey = "messages" | "analytics" | "bookings" | "crm" | "estimates";

export const ALL_FEATURES: { key: FeatureKey; label: string; icon: string }[] = [
  { key: "messages", label: "Messages", icon: "💬" },
  { key: "analytics", label: "Analytics", icon: "📊" },
  { key: "bookings", label: "Estimate & Apt Manager", icon: "📅" },
  { key: "crm", label: "Customer CRM", icon: "👥" },
  { key: "estimates", label: "Estimate Creator", icon: "📋" },
];

export function hasFeature(features: Record<string, boolean> | null | undefined, key: FeatureKey): boolean {
  if (!features) return false;
  return features[key] === true;
}

export function allFeaturesOn(): Record<FeatureKey, boolean> {
  return { messages: true, analytics: true, bookings: true, crm: true, estimates: true };
}

export function allFeaturesOff(): Record<FeatureKey, boolean> {
  return { messages: false, analytics: false, bookings: false, crm: false, estimates: false };
}
