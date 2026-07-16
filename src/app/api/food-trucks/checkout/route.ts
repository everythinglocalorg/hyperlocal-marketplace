import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { computeLbDiscount } from "@/lib/lb-discount";

// $5/month — the same as a job post — pins a food truck to the top of its city's
// Food Trucks board. Every truck is listed for free; this only buys placement.
const FOOD_TRUCK_FEATURE_PRICE_CENTS = 500;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { vendor_id, apply_local_bucks } = await req.json();
    if (!vendor_id) return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });

    // Must be a food truck this user actually owns — an unclaimed truck has to be
    // claimed first, which is what stops anyone featuring someone else's business.
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, user_id, business_name, category, city, state, food_truck_featured")
      .eq("id", vendor_id)
      .maybeSingle();

    if (!vendor || vendor.category !== "Food Trucks") {
      return NextResponse.json({ error: "Food truck not found" }, { status: 404 });
    }
    if (!vendor.user_id || vendor.user_id !== user.id) {
      return NextResponse.json({ error: "Claim this food truck before featuring it." }, { status: 403 });
    }
    if (vendor.food_truck_featured) {
      return NextResponse.json({ error: "This food truck is already featured." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name, local_bucks")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://everythinglocal.org";
    const citySlug = `${vendor.city.toLowerCase().replace(/\s+/g, "-")}-${vendor.state.toLowerCase()}`;

    // Local Bucks discount the first month (validated server-side).
    const charge = computeLbDiscount(FOOD_TRUCK_FEATURE_PRICE_CENTS, Number(apply_local_bucks) || 0, profile?.local_bucks ?? 0);
    let discounts: { coupon: string }[] | undefined;
    if (charge.discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: charge.discountCents, currency: "usd", duration: "once",
        max_redemptions: 1, name: `${charge.appliedLB} Local Bucks`,
      });
      discounts = [{ coupon: coupon.id }];
    }
    const meta = { type: "food_truck_feature", vendor_id: vendor.id, user_id: user.id, lb: String(charge.appliedLB) };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: `Everything Local — Featured Food Truck (${vendor.business_name})` },
          unit_amount: FOOD_TRUCK_FEATURE_PRICE_CENTS,
          recurring: { interval: "month" },
        },
      }],
      // metadata drives the webhook: feature this truck once paid.
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${appUrl}/food-trucks/${citySlug}?featured=1`,
      cancel_url: `${appUrl}/food-trucks/${citySlug}?feature_cancelled=1`,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Food truck feature checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
