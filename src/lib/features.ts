export type FeatureKey = "messages" | "analytics" | "bookings" | "crm" | "estimates";

// Membership tiers. `premium` = Local Pro ($49), `premium_plus` = Local Pro+ ($129).
export type Tier = "free" | "premium" | "premium_plus";
export const TIER_LABELS: Record<string, string> = {
  free: "Free",
  premium: "Local Pro",
  premium_plus: "Local Pro+",
};

// True for any paid tier — use this for feature/access gates so Pro+ keeps
// everything Pro has.
export function isPaidTier(tier?: string | null): boolean {
  return tier === "premium" || tier === "premium_plus";
}

// True only for the top tier (Local Pro+). Use for Plus-exclusive gates.
export function isPlusTier(tier?: string | null): boolean {
  return tier === "premium_plus";
}

// Max active listings per tier. Infinity = unlimited (Local Pro+).
export const LISTING_CAPS: Record<string, number> = {
  free: 5,
  premium: 15,
  premium_plus: Infinity,
};
export function listingCap(tier?: string | null): number {
  return LISTING_CAPS[tier ?? "free"] ?? 5;
}

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

// Canonical map of which functional features each tier unlocks. Single source
// of truth for tier assignment (admin + onboarding). Local Pro gets the pro
// toolset; the Estimate Creator is a Local Pro+ exclusive.
export function featuresForTier(tier?: string | null): Record<FeatureKey, boolean> {
  if (tier === "premium_plus") return allFeaturesOn();
  if (tier === "premium") return { messages: true, analytics: true, bookings: true, crm: true, estimates: false };
  return allFeaturesOff();
}
