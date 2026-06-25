import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Opens the Stripe Express dashboard for an already-connected vendor
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors")
    .select("stripe_connect_account_id")
    .eq("user_id", user.id)
    .single();

  if (!vendor?.stripe_connect_account_id) {
    return NextResponse.json({ error: "No connected account" }, { status: 404 });
  }

  const loginLink = await stripe.accounts.createLoginLink(
    vendor.stripe_connect_account_id
  );

  return NextResponse.json({ url: loginLink.url });
}
