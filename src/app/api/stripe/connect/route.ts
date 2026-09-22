import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
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

  // A user can own SEVERAL businesses, so never use .single() (it errors on
  // multiple rows). Connect the specific vendor the dashboard has selected
  // (?vendor=), scoped to this user so they can only touch their own; fall back
  // to their first business when none is specified.
  const body = await request.json().catch(() => ({} as { vendor_id?: string }));
  const vendorId = typeof body?.vendor_id === "string" ? body.vendor_id : null;

  let vendorQuery = supabase
    .from("vendors")
    .select("id, business_name, stripe_connect_account_id")
    .eq("user_id", user.id);
  if (vendorId) vendorQuery = vendorQuery.eq("id", vendorId);
  const { data: vendor, error: vendorError } = await vendorQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

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
      // Our platform is configured as a losses collector, so Stripe rejects the
      // legacy `type: "express"` field. Use `controller` properties instead:
      // Express dashboard, the connected account pays Stripe fees, and Stripe
      // collects losses. (Equivalent to the old Express account, minus `type`.)
      const account = await stripe.accounts.create({
        controller: {
          losses: { payments: "stripe" },
          fees: { payer: "account" },
          stripe_dashboard: { type: "express" },
        },
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
