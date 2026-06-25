import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, stripe_connect_account_id")
    .eq("user_id", user.id)
    .single();

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

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

    await supabase
      .from("vendors")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", vendor.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/vendor?connect=refresh`,
    return_url: `${appUrl}/dashboard/vendor?connect=success`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
