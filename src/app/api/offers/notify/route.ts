import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

// Push for thrift offers. Offers are written client-side (and guests can make
// them), so the client pings this after a successful write and the server
// decides who to notify — the client never names a recipient.
//
//   • vendor owner calls it  → the offer's status changed → push the BUYER
//   • anyone else calls it   → treat as a fresh offer      → push the VENDOR
//     (guarded: must still be pending and newly created, so this can't be
//      replayed to spam a vendor)

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function money(n: number) { return `$${Number(n).toFixed(2)}`; }

export async function POST(req: NextRequest) {
  const { offerId } = await req.json().catch(() => ({ offerId: null }));
  if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true });

  const admin = getAdmin();
  const { data: offer } = await admin
    .from("thrift_offers")
    .select("id, vendor_id, buyer_id, buyer_name, amount, counter_amount, status, listing_title, created_at")
    .eq("id", offerId)
    .single();
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

  const { data: vendor } = await admin
    .from("vendors")
    .select("business_name, user_id")
    .eq("id", offer.vendor_id)
    .single();

  // Is the caller the vendor who owns this offer?
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const callerIsVendor = !!user && !!vendor?.user_id && user.id === vendor.user_id;

  if (callerIsVendor) {
    // Vendor responded — tell the buyer (only if they have an account).
    if (!offer.buyer_id) return NextResponse.json({ ok: true });
    const item = offer.listing_title ?? "your item";
    const copy: Record<string, { title: string; body: string }> = {
      accepted: { title: "🎉 Offer accepted!", body: `${vendor?.business_name} accepted your ${money(offer.amount)} offer on ${item}.` },
      declined: { title: "Offer declined", body: `${vendor?.business_name} passed on your offer for ${item}.` },
      countered: { title: "↔ You got a counter-offer", body: `${vendor?.business_name} countered at ${money(offer.counter_amount ?? offer.amount)} for ${item}.` },
    };
    const c = copy[offer.status];
    if (!c) return NextResponse.json({ ok: true });

    await sendPushToUser(offer.buyer_id, { ...c, url: "/dashboard/buyer", tag: `offer-${offer.id}` });
    return NextResponse.json({ ok: true });
  }

  // Otherwise: a fresh offer → notify the vendor. Guard against replays.
  const ageMs = Date.now() - new Date(offer.created_at).getTime();
  if (offer.status !== "pending" || ageMs > 2 * 60 * 1000) {
    return NextResponse.json({ ok: true });
  }
  if (!vendor?.user_id) return NextResponse.json({ ok: true });

  await sendPushToUser(vendor.user_id, {
    title: `💲 New offer: ${money(offer.amount)}`,
    body: `${offer.buyer_name} made an offer on ${offer.listing_title ?? "your item"}.`,
    url: "/dashboard/vendor?tab=offers",
    tag: `offer-${offer.id}`,
  });
  return NextResponse.json({ ok: true });
}
