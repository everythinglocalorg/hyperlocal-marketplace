import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  // Fail loudly if Stripe isn't configured rather than throwing a vague 500
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments aren't configured yet. Please contact support." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to connect Stripe." }, { status: 401 });

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id, business_name, stripe_connect_account_id")
    .eq("user_id", user.id)
    .single();

  if (vendorError || !vendor) {
    return NextResponse.json(
      { error: "We couldn't find your business account. Try refreshing the page." },
      { status: 404 }
    );
  }

  try {
    // Reuse existing Connect account or create a new one
    let accountId = vendor.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        business_profile: { name: vendor.business_name },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { vendor_id: vendor.id, user_id: user.id },
      });

      accountId = account.id;

      const { error: updateError } = await supabase
        .from("vendors")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", vendor.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Couldn't save your Stripe account. The database may be missing the Stripe columns — run supabase/stripe.sql." },
          { status: 500 }
        );
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/vendor?connect=refresh`,
      return_url: `${appUrl}/dashboard/vendor?connect=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Stripe onboarding.";
    console.error("Stripe connect error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
