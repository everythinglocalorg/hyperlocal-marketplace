import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Charge a rental deposit (or full amount) by card. Funds route 100% to the
// vendor's connected Express account (destination charge, no platform fee),
// mirroring the proposal deposit flow. The amount is recomputed server-side
// from the listing's deposit config — never trusted from the browser.
//
// Returns { url } to redirect to Stripe Checkout, or { skip: true } when no
// deposit is due / the vendor can't take cards yet (booking just stays pending).
export async function POST(req: NextRequest) {
  const { bookingId } = await req.json().catch(() => ({}));
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  // The customer who just created the booking must be the caller.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: booking } = await db
    .from("rental_bookings")
    .select("id, customer_id, total_price, duration_label, payment_status, listing:listings(title, rental_deposit_type, rental_deposit_value), vendor:vendors(id, business_name, stripe_connect_account_id, stripe_connect_enabled)")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing;
  const vendor = Array.isArray(booking.vendor) ? booking.vendor[0] : booking.vendor;

  const depositType = (listing?.rental_deposit_type as string) ?? "none";
  const depositValue = Number(listing?.rental_deposit_value ?? 0);
  const total = Number(booking.total_price ?? 0);

  // How much is due now.
  let amount = 0;
  if (depositType === "full") amount = total;
  else if (depositType === "percent") amount = total * (depositValue / 100);
  const isFull = depositType === "full" || amount >= total;

  if (!process.env.STRIPE_SECRET_KEY || depositType === "none" || amount <= 0) {
    return NextResponse.json({ skip: true }); // nothing to charge — booking stays pending
  }
  if (!vendor?.stripe_connect_account_id || !vendor?.stripe_connect_enabled) {
    // Vendor isn't set up for cards — don't block the booking, they'll settle directly.
    return NextResponse.json({ skip: true });
  }

  const cents = Math.round(amount * 100);
  if (cents < 50) return NextResponse.json({ skip: true }); // too small to charge

  await db.from("rental_bookings").update({ deposit_amount: amount }).eq("id", booking.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const label = isFull ? "Payment" : "Deposit";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `${label} — ${listing?.title ?? "Rental"}`, description: vendor.business_name },
        unit_amount: cents,
      },
      quantity: 1,
    }],
    payment_intent_data: {
      description: `${label} for ${listing?.title ?? "rental"} (${booking.duration_label})`,
      transfer_data: { destination: vendor.stripe_connect_account_id },
      metadata: { type: "rental_deposit", booking_id: booking.id, full: isFull ? "1" : "0" },
    },
    success_url: `${appUrl}/dashboard/buyer?tab=bookings&rental_paid=1`,
    cancel_url: `${appUrl}/dashboard/buyer?tab=bookings&rental_cancelled=1`,
    metadata: { type: "rental_deposit", booking_id: booking.id, full: isFull ? "1" : "0" },
  });

  return NextResponse.json({ url: session.url });
}
