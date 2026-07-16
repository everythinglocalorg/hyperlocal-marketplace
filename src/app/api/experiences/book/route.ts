import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Pay for an Experience booking. Per docs/local-experiences.md an Experience is
// free or paid IN FULL — there are no deposits — and the money goes 100% to the
// Guide's connected account (destination charge, no platform fee; the platform's
// cut is the one-time release fee instead).
//
// The price is read server-side from the listing, never trusted from the browser.
// Returns { url } for Stripe Checkout, or { skip: true } when the Experience is
// free or the Guide can't take cards yet — the booking request still stands and
// the Guide settles directly.
export async function POST(req: NextRequest) {
  try {
    const { inquiry_id } = await req.json().catch(() => ({}));
    if (!inquiry_id) return NextResponse.json({ error: "Missing inquiry_id" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = admin();
    const { data: inquiry } = await db
      .from("purchase_inquiries")
      .select("id, buyer_id, listing_id, paid_at, listing:listings(id, title, type, price, is_active), vendor:vendors(id, business_name, stripe_connect_account_id, stripe_connect_enabled)")
      .eq("id", inquiry_id)
      .maybeSingle();

    if (!inquiry) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (inquiry.buyer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (inquiry.paid_at) return NextResponse.json({ skip: true }); // already paid

    const listing: any = Array.isArray(inquiry.listing) ? inquiry.listing[0] : inquiry.listing;
    const vendor: any = Array.isArray(inquiry.vendor) ? inquiry.vendor[0] : inquiry.vendor;
    if (!listing || listing.type !== "experience" || !listing.is_active) {
      return NextResponse.json({ error: "Experience not available" }, { status: 404 });
    }

    const amount = Number(listing.price ?? 0);
    const cents = Math.round(amount * 100);
    // Free Experience, no Stripe configured, or a Guide who hasn't connected
    // payouts — leave it as a booking request rather than blocking the buyer.
    if (!process.env.STRIPE_SECRET_KEY || cents < 50) return NextResponse.json({ skip: true });
    if (!vendor?.stripe_connect_account_id || !vendor?.stripe_connect_enabled) {
      return NextResponse.json({ skip: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const meta = { type: "experience_booking", inquiry_id: inquiry.id, listing_id: listing.id };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: listing.title, description: `Experience by ${vendor.business_name}` },
          unit_amount: cents,
        },
      }],
      payment_intent_data: {
        description: `Experience booking — ${listing.title}`,
        transfer_data: { destination: vendor.stripe_connect_account_id },
        metadata: meta,
      },
      metadata: meta,
      success_url: `${appUrl}/experiences/${listing.id}?booked=1`,
      cancel_url: `${appUrl}/experiences/${listing.id}?booking_cancelled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Experience booking checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
