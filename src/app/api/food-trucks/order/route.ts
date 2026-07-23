import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Customer places a pickup order with a food truck. Server recomputes the total
// from live listing prices, saves the ticket, and pings the truck.
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type InItem = { listing_id?: string; qty?: number };

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to order." }, { status: 401 });

  const { vendorId, items, name, phone, notes } = await req.json().catch(() => ({}));
  if (!vendorId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Add at least one item to your order." }, { status: 400 });
  }

  const db = admin();
  const { data: vendor } = await db
    .from("vendors").select("id, business_name, user_id, category, food_truck").eq("id", vendorId).maybeSingle();
  if (!vendor || vendor.category !== "Food Trucks") {
    return NextResponse.json({ error: "This vendor isn't taking orders." }, { status: 404 });
  }

  // Never trust client prices — rebuild from the vendor's own listings.
  const ids = (items as InItem[]).map((i) => i.listing_id).filter(Boolean) as string[];
  const { data: listings } = await db.from("listings").select("id, title, price").in("id", ids).eq("vendor_id", vendorId);
  const byId = new Map((listings ?? []).map((l) => [l.id, l]));
  const clean = (items as InItem[])
    .map((i) => {
      const l = i.listing_id ? byId.get(i.listing_id) : undefined;
      if (!l) return null;
      const qty = Math.max(1, Math.min(50, Math.floor(Number(i.qty) || 1)));
      return { listing_id: l.id, title: l.title as string, qty, price: Number(l.price) || 0 };
    })
    .filter((x): x is { listing_id: string; title: string; qty: number; price: number } => !!x);
  if (clean.length === 0) return NextResponse.json({ error: "Those items aren't available anymore." }, { status: 400 });

  const total = clean.reduce((s, i) => s + i.price * i.qty, 0);
  const spot = (vendor.food_truck as { spot?: { name?: string } } | null)?.spot?.name || null;

  const { data: order, error } = await db.from("food_orders").insert({
    vendor_id: vendorId,
    customer_id: user.id,
    customer_name: name || null,
    customer_phone: phone || null,
    items: clean,
    total,
    pickup_spot: spot,
    notes: notes || null,
    status: "new",
  }).select("id").single();
  if (error || !order) return NextResponse.json({ error: error?.message ?? "Couldn't place your order." }, { status: 500 });

  if (vendor.user_id) {
    await db.from("notifications").insert({
      user_id: vendor.user_id,
      actor_id: user.id,
      type: "food_order",
      title: "🧾 New pickup order",
      body: `${clean.length} item${clean.length === 1 ? "" : "s"} · $${total.toFixed(2)}${name ? ` · ${name}` : ""}`,
      link: "/dashboard/vendor?tab=orders",
      is_read: false,
    });
  }

  return NextResponse.json({ id: order.id, total });
}
