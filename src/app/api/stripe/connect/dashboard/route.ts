import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Opens the Stripe Express dashboard for an already-connected vendor
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Multi-business owners: open the dashboard for the selected vendor (?vendor=),
  // scoped to this user. Never .single() — it errors when they own several.
  const body = await request.json().catch(() => ({} as { vendor_id?: string }));
  const vendorId = typeof body?.vendor_id === "string" ? body.vendor_id : null;

  let vendorQuery = supabase
    .from("vendors")
    .select("stripe_connect_account_id")
    .eq("user_id", user.id);
  if (vendorId) vendorQuery = vendorQuery.eq("id", vendorId);
  const { data: vendor } = await vendorQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!vendor?.stripe_connect_account_id) {
    return NextResponse.json({ error: "No connected account" }, { status: 404 });
  }

  const loginLink = await stripe.accounts.createLoginLink(
    vendor.stripe_connect_account_id
  );

  return NextResponse.json({ url: loginLink.url });
}
