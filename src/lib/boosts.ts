// Paid "boosts" — a vendor pays a monthly subscription to feature a product
// (listing) or their business (vendor) in a high-visibility spot. Boosted items
// blend into the same rows as naturally-new items, shown first.
//
//   homepage    → Featured Gems (products) / New Businesses (vendors), $5/mo
//   local_pages → the city's Local Loop board, $10/mo

export const BOOST_PLACEMENTS = {
  homepage: { label: "Homepage feature", priceCents: 500, priceLabel: "$5/mo" },
  local_pages: { label: "Local Loop feature", priceCents: 1000, priceLabel: "$10/mo" },
} as const;

export type BoostPlacement = keyof typeof BOOST_PLACEMENTS;
export type BoostEntityType = "listing" | "vendor";

export function isBoostPlacement(v: unknown): v is BoostPlacement {
  return typeof v === "string" && v in BOOST_PLACEMENTS;
}

// Local Bucks toward a boost — shared with all monthly memberships (20% cap,
// 1 LB = $1): $1 off a $5 boost, $2 off $10. See lib/lb-discount.
import { computeLbDiscount, LB_CENTS, LB_MAX_PCT } from "./lb-discount";
export { LB_CENTS as LOCAL_BUCK_CENTS, LB_MAX_PCT as LB_BOOST_MAX_PCT };

export function computeBoostCharge(placement: BoostPlacement, requestedLB: number, balance: number) {
  return computeLbDiscount(BOOST_PLACEMENTS[placement].priceCents, requestedLB, balance);
}
