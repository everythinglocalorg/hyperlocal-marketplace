import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Stop featuring a food truck: cancel the $5/month subscription and unpin it.
// Unlike a job, the truck itself is NOT deleted — it stays listed for free, it
// just loses its spot at the top of the board.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { vendor_id } = await req.json();
    if (!vendor_id) return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });

    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, user_id, food_truck_subscription_id")
      .eq("id", vendor_id)
      .maybeSingle();
    if (!vendor || vendor.user_id !== user.id) {
      return NextResponse.json({ error: "Food truck not found" }, { status: 404 });
    }

    if (vendor.food_truck_subscription_id) {
      try {
        await stripe.subscriptions.cancel(vendor.food_truck_subscription_id);
      } catch (e) {
        // Already canceled / not found — safe to continue and unpin anyway.
        console.error("Food truck subscription cancel failed:", e instanceof Error ? e.message : e);
      }
    }

    const { error } = await supabase
      .from("vendors")
      .update({ food_truck_featured: false, food_truck_subscription_id: null })
      .eq("id", vendor_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Food truck cancel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
