import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
      success_url: `${appUrl}/dashboard/vendor?upgraded=1`,
      cancel_url: `${appUrl}/dashboard/vendor/upgrade?cancelled=1`,
      metadata: { vendor_id: vendor.id, user_id: user.id },
      subscription_data: { metadata: { vendor_id: vendor.id, user_id: user.id } },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
