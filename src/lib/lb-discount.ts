// Local Bucks can offset up to 20% of ANY monthly membership (boosts, jobs,
// Local Pro). 1 LB = $1. At 20%: $1 off a $5 plan, $2 off $10, up to ~$9 off
// Local Pro ($49). LB only discounts the FIRST month (finite credit + recurring
// price) — applied via a one-time Stripe coupon and deducted via
// spend_local_bucks once payment clears.
export const LB_CENTS = 100;      // 1 Local Buck = $1.00
export const LB_MAX_PCT = 0.20;   // LB covers at most 20% of the price

export function computeLbDiscount(priceCents: number, requestedLB: number, balance: number) {
  const maxDiscountCents = Math.floor(priceCents * LB_MAX_PCT);
  const maxLB = Math.min(Math.floor(maxDiscountCents / LB_CENTS), Math.max(0, Math.floor(balance || 0)));
  const appliedLB = Math.max(0, Math.min(Math.floor(requestedLB || 0), maxLB));
  const discountCents = appliedLB * LB_CENTS;
  return { priceCents, maxLB, appliedLB, discountCents, firstChargeCents: priceCents - discountCents };
}
