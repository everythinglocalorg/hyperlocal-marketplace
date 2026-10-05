import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeFoodTruck, orderPingMessage } from "@/lib/foodtruck";
import { sendPushToUser } from "@/lib/push";

// The truck advances an order ticket (New → Preparing → Ready → Completed).
// Verifies ownership and pings the customer when the order is "ready" (order up!).
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID = ["new", "preparing", "ready", "completed", "cancelled"];

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !VALID.includes(status)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const db = admin();
  const { data: order } = await db.from("food_orders").select("id, vendor_id, customer_id, status").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: vendor } = await db.from("vendors").select("id, business_name, slug, user_id, food_truck").eq("id", order.vendor_id).maybeSingle();
  if (!vendor || vendor.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "ready") patch.ready_at = new Date().toISOString();
  const { error } = await db.from("food_orders").update(patch).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the customer posted through the whole order — started, ready, and
  // complete (with a nudge to leave a review). Uses the truck's own custom
  // messages when set. Delivered to the inbox (Notifications tab) + web push.
  if (order.customer_id && (status === "preparing" || status === "ready" || status === "completed")) {
    const ft = normalizeFoodTruck(vendor.food_truck);
    let type: string, title: string, body: string;
    let link = `/vendors/${vendor.slug}`;
    if (status === "preparing") {
      type = "food_order_started";
      title = `👨‍🍳 ${vendor.business_name} is on it`;
      body = orderPingMessage(ft, "started", ft.spot.name);
    } else if (status === "ready") {
      type = "food_order_ready";
      title = `🔔 Order up at ${vendor.business_name}!`;
      body = orderPingMessage(ft, "ready", ft.spot.name);
    } else {
      type = "food_order_complete";
      title = `✅ Thanks for ordering from ${vendor.business_name}!`;
      body = `Your order is complete. Tap to leave a quick review — it really helps ${vendor.business_name}.`;
      link = `/vendors/${vendor.slug}?review=1`;
    }
    await db.from("notifications").insert({
      user_id: order.customer_id, actor_id: user.id, type, title, body, link, is_read: false,
    });
    sendPushToUser(order.customer_id, { title, body, url: link, tag: `order-${order.id}` }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
