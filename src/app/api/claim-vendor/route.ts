import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Submitting a claim now creates a PENDING request that an admin verifies and
// approves — it no longer instantly transfers ownership.
export async function POST(request: Request) {
  const { slug, full_name, contact_email, contact_phone, message } = await request.json();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors").select("id, is_claimed").eq("slug", slug).maybeSingle();
  if (!vendor) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (vendor.is_claimed) {
    return NextResponse.json({ error: "This business has already been claimed." }, { status: 400 });
  }

  // Insert respects RLS (auth.uid() = user_id) and the (vendor_id,user_id) unique key
  const { error } = await supabase.from("claim_requests").insert({
    vendor_id: vendor.id,
    user_id: user.id,
    full_name: full_name?.trim() || null,
    contact_email: contact_email?.trim() || null,
    contact_phone: contact_phone?.trim() || null,
    message: message?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already submitted a claim for this business — it's pending review." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pending: true });
}
