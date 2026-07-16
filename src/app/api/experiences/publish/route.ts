import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { isPaidTier } from "@/lib/features";

// Releasing an Experience costs a one-time platform fee (see
// docs/local-experiences.md): $50 the FIRST time it ever goes live, $10 for every
// re-publish after a pause. Paid once → it stays live until the Guide pauses it.
const FIRST_PUBLISH_CENTS = 5000;
const REPUBLISH_CENTS = 1000;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { listing_id } = await req.json();
    if (!listing_id) return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });

    // Must be an experience owned by this user, on a paid membership.
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, type, vendor:vendors(id, user_id, tier)")
      .eq("id", listing_id)
      .maybeSingle();
    const vendor: any = Array.isArray(listing?.vendor) ? listing?.vendor[0] : listing?.vendor;
    if (!listing || listing.type !== "experience" || !vendor || vendor.user_id !== user.id) {
      return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    }
    if (!isPaidTier(vendor.tier)) {
      return NextResponse.json({ error: "Only businesses on a paid membership can publish Experiences." }, { status: 403 });
    }

    // First release ever = $50; any re-publish after a pause = $10.
    const { data: meta } = await supabase
      .from("experience_meta")
      .select("first_published_at")
      .eq("listing_id", listing_id)
      .maybeSingle();
    const isFirst = !meta?.first_published_at;
    const amount = isFirst ? FIRST_PUBLISH_CENTS : REPUBLISH_CENTS;

    // Reuse/create the user's Stripe customer.
    const { data: profile } = await supabase
      .from("profiles").select("stripe_customer_id, full_name").eq("id", user.id).maybeSingle();
    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email, name: profile?.full_name ?? undefined, metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://everythinglocal.org";
    const meta_ = { type: "experience_publish", listing_id: listing.id, user_id: user.id };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: isFirst ? "Everything Local — Experience release" : "Everything Local — Experience re-publish" },
          unit_amount: amount,
        },
      }],
      // metadata drives the webhook: publish this experience once paid.
      metadata: meta_,
      payment_intent_data: { metadata: meta_ },
      success_url: `${appUrl}/dashboard/experiences?published=1`,
      cancel_url: `${appUrl}/dashboard/experiences?publish_cancelled=1`,
    });

    return NextResponse.json({ url: session.url, amount, first: isFirst });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Experience publish checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
