import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { computeLbDiscount } from "@/lib/lb-discount";
import { LOCAL_PRO_PRICE } from "@/lib/pricing";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Body is optional (older callers POST with none) — default LB to 0.
    const { apply_local_bucks } = await req.json().catch(() => ({}));

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, business_name, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (vendorError || !vendor) {
      console.error("Vendor lookup failed:", vendorError);
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    let customerId = vendor.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: vendor.business_name,
        metadata: { vendor_id: vendor.id, user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("vendors")
        .update({ stripe_customer_id: customerId })
        .eq("id", vendor.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hyperlocal-marketplace-ochre.vercel.app";

    // Local Bucks can offset up to 20% of the first month (validated server-side).
    const { data: profile } = await supabase.from("profiles").select("local_bucks").eq("id", user.id).single();
    const charge = computeLbDiscount(LOCAL_PRO_PRICE * 100, Number(apply_local_bucks) || 0, profile?.local_bucks ?? 0);
    let discounts: { coupon: string }[] | undefined;
    if (charge.discountCents > 0) {
      const coupon = await stripe.coupons.create({ amount_off: charge.discountCents, currency: "usd", duration: "once", max_redemptions: 1, name: `${charge.appliedLB} Local Bucks` });
      discounts = [{ coupon: coupon.id }];
    }
    const meta = { vendor_id: vendor.id, user_id: user.id, lb: String(charge.appliedLB) };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
      success_url: `${appUrl}/dashboard/vendor?upgraded=1`,
      cancel_url: `${appUrl}/dashboard/vendor/upgrade?cancelled=1`,
      metadata: meta,
      subscription_data: { metadata: meta },
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
