import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { BOOST_PLACEMENTS, isBoostPlacement, computeBoostCharge } from "@/lib/boosts";
import { makeSlug, normalizeState } from "@/lib/cities";

// Start a monthly boost subscription for a listing or a vendor. The boost row
// is created as a draft (is_active false) and flipped live by the webhook once
// payment succeeds.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { entity_type, entity_id, placement, return_path, apply_local_bucks } = await req.json();
    if (!isBoostPlacement(placement)) return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
    if (entity_type !== "listing" && entity_type !== "vendor") return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    if (!entity_id) return NextResponse.json({ error: "Missing entity_id" }, { status: 400 });

    // Verify the user owns the thing they're boosting, and derive its city.
    let vendorId: string;
    let citySlug: string | null = null;
    if (entity_type === "vendor") {
      const { data: v } = await supabase.from("vendors").select("id, user_id, city, state").eq("id", entity_id).single();
      if (!v || v.user_id !== user.id) return NextResponse.json({ error: "Not your business" }, { status: 403 });
      vendorId = v.id;
      citySlug = v.city ? makeSlug(v.city, normalizeState(v.state ?? "")) : null;
    } else {
      const { data: l } = await supabase.from("listings").select("id, vendor:vendors(id, user_id, city, state)").eq("id", entity_id).single();
      const v = Array.isArray(l?.vendor) ? l?.vendor[0] : l?.vendor;
      if (!l || !v || v.user_id !== user.id) return NextResponse.json({ error: "Not your listing" }, { status: 403 });
      vendorId = v.id;
      citySlug = v.city ? makeSlug(v.city, normalizeState(v.state ?? "")) : null;
    }

    // Create the draft boost.
    const { data: boost, error: boostErr } = await supabase.from("featured_boosts").insert({
      user_id: user.id,
      vendor_id: vendorId,
      entity_type,
      entity_id,
      placement,
      city_slug: citySlug,
      is_active: false,
    }).select("id").single();
    if (boostErr || !boost) return NextResponse.json({ error: "Could not start boost" }, { status: 500 });

    // Reuse/create the user's Stripe customer (stored on their profile).
    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id, full_name, local_bucks").eq("id", user.id).single();
    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: profile?.full_name ?? undefined, metadata: { user_id: user.id } });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const cfg = BOOST_PLACEMENTS[placement];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hyperlocal-marketplace-ochre.vercel.app";
    const back = typeof return_path === "string" && return_path.startsWith("/") ? return_path : "/dashboard/vendor";

    // Local Bucks (validated server-side, capped at 15% and the user's balance)
    // discount the first month via a one-time coupon; deducted on the webhook.
    const charge = computeBoostCharge(placement, Number(apply_local_bucks) || 0, profile?.local_bucks ?? 0);
    let discounts: { coupon: string }[] | undefined;
    if (charge.discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: charge.discountCents,
        currency: "usd",
        duration: "once",
        max_redemptions: 1,
        name: `${charge.appliedLB} Local Bucks`,
      });
      discounts = [{ coupon: coupon.id }];
    }
    const meta = { type: "boost", boost_id: boost.id, user_id: user.id, lb: String(charge.appliedLB) };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: `Everything Local — ${cfg.label}` },
          unit_amount: cfg.priceCents,
          recurring: { interval: "month" },
        },
      }],
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${appUrl}${back}?boosted=1`,
      cancel_url: `${appUrl}${back}?boost_cancelled=1`,
      // `discounts` and `allow_promotion_codes` are mutually exclusive in Stripe.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Boost checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
