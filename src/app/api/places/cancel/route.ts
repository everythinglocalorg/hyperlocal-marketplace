import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { place_id } = await req.json();
    if (!place_id) return NextResponse.json({ error: "Missing place_id" }, { status: 400 });

    const { data: place } = await supabase
      .from("places")
      .select("id, created_by, stripe_subscription_id")
      .eq("id", place_id)
      .single();
    if (!place || place.created_by !== user.id) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (place.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(place.stripe_subscription_id);
      } catch (e) {
        console.error("Place subscription cancel failed:", e instanceof Error ? e.message : e);
      }
    }

    const { error } = await supabase.from("places").delete().eq("id", place_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Place cancel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
