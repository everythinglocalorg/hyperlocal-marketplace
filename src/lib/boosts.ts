// Paid "boosts" — a vendor pays a monthly subscription to feature a product
// (listing) or their business (vendor) in a high-visibility spot. Boosted items
// blend into the same rows as naturally-new items, shown first.
//
//   homepage    → Featured Gems (products) / New Businesses (vendors), $5/mo
//   local_pages → the city's Local Pages board, $10/mo

export const BOOST_PLACEMENTS = {
  homepage: { label: "Homepage feature", priceCents: 500, priceLabel: "$5/mo" },
  local_pages: { label: "Local Pages feature", priceCents: 1000, priceLabel: "$10/mo" },
} as const;

export type BoostPlacement = keyof typeof BOOST_PLACEMENTS;
export type BoostEntityType = "listing" | "vendor";

export function isBoostPlacement(v: unknown): v is BoostPlacement {
  return typeof v === "string" && v in BOOST_PLACEMENTS;
}
