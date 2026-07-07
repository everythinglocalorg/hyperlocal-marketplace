import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// $5/month keeps a paid place listing live (attraction, thing_to_do, food_truck).
// Same pattern as /api/jobs/checkout.
const PLACE_POST_PRICE_CENTS = 500;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { place_id } = await req.json();
    if (!place_id) return NextResponse.json({ error: "Missing place_id" }, { status: 400 });

    const { data: place } = await supabase
      .from("places")
      .select("id, created_by, slug, name, city_slug")
      .eq("id", place_id)
      .single();
    if (!place || place.created_by !== user.id) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hyperlocal-marketplace-ochre.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: `Everything Local — ${place.name}` },
          unit_amount: PLACE_POST_PRICE_CENTS,
          recurring: { interval: "month" },
        },
      }],
      metadata: { type: "place_post", place_id: place.id, user_id: user.id },
      subscription_data: { metadata: { type: "place_post", place_id: place.id, user_id: user.id } },
      success_url: `${appUrl}/places/${place.slug}?posted=1`,
      cancel_url: `${appUrl}/explore/${place.city_slug}?post_cancelled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Place checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
