import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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

  if (status === "ready" && order.customer_id) {
    const spot = (vendor.food_truck as { spot?: { name?: string } } | null)?.spot?.name;
    await db.from("notifications").insert({
      user_id: order.customer_id,
      actor_id: user.id,
      type: "food_order_ready",
      title: `🔔 Order up at ${vendor.business_name}!`,
      body: spot ? `Your order is ready — grab it at ${spot}.` : "Your order is ready for pickup.",
      link: `/vendors/${vendor.slug}`,
      is_read: false,
    });
  }

  return NextResponse.json({ ok: true });
}
