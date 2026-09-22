import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A user can own several businesses — never .single() (errors on multiple).
  // Use the dashboard's selected vendor_id, scoped to this user; else first.
  const body = await request.json().catch(() => ({} as { vendor_id?: string }));
  const vendorId = typeof body?.vendor_id === "string" ? body.vendor_id : null;
  let vq = supabase.from("vendors").select("stripe_customer_id").eq("user_id", user.id);
  if (vendorId) vq = vq.eq("id", vendorId);
  const { data: vendor } = await vq.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (!vendor?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: vendor.stripe_customer_id,
    return_url: `${appUrl}/dashboard/vendor`,
  });

  return NextResponse.json({ url: session.url });
}
