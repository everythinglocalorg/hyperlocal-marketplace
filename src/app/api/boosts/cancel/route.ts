import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Cancel a boost: end its Stripe subscription and remove the boost row so the
// item drops back to its organic position.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { boost_id } = await req.json();
    if (!boost_id) return NextResponse.json({ error: "Missing boost_id" }, { status: 400 });

    const { data: boost } = await supabase
      .from("featured_boosts")
      .select("id, user_id, stripe_subscription_id")
      .eq("id", boost_id)
      .single();
    if (!boost || boost.user_id !== user.id) return NextResponse.json({ error: "Boost not found" }, { status: 404 });

    if (boost.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(boost.stripe_subscription_id);
      } catch (e) {
        console.error("Boost subscription cancel failed:", e instanceof Error ? e.message : e);
      }
    }

    const { error } = await supabase.from("featured_boosts").delete().eq("id", boost_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Boost cancel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
