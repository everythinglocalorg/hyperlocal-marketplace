import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Pings a food truck's followers with an in-app notification when it goes live.
// Called by the vendor dashboard right after the vendor flips their status to open.
function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The caller must own a Food Trucks vendor.
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, slug, category, food_truck")
    .eq("user_id", user.id)
    .eq("category", "Food Trucks")
    .maybeSingle();
  if (!vendor) return NextResponse.json({ error: "No food truck found for this account." }, { status: 404 });

  const admin = getSupabaseAdmin();

  const { data: followers } = await admin
    .from("follows")
    .select("follower_id")
    .eq("target_type", "vendor")
    .eq("target_id", vendor.id);

  const recipients = Array.from(
    new Set((followers ?? []).map((f) => f.follower_id).filter((id) => id && id !== user.id))
  );
  if (recipients.length === 0) return NextResponse.json({ notified: 0 });

  const spotName = (vendor.food_truck as { spot?: { name?: string } } | null)?.spot?.name || null;
  const link = `/vendors/${vendor.slug}`;
  const body = spotName ? `Live now at ${spotName} — come grab a bite!` : "We're live and serving!";

  const rows = recipients.map((rid) => ({
    user_id: rid,
    actor_id: user.id,
    type: "food_truck_live",
    title: `🚚 ${vendor.business_name} is open`,
    body,
    link,
    is_read: false,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notified: recipients.length });
}
