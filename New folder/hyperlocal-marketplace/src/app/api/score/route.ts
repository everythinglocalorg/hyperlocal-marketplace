import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// action: "login" (1pt, once/day), "message" (1pt), "listing" (1pt), "sale" (2pt + products_sold++)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, vendor_id } = await req.json();
  if (!vendor_id) return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });

  const PTS: Record<string, number> = { login: 1, message: 1, listing: 1, sale: 2 };
  const pts = PTS[action] ?? 0;
  if (!pts) return NextResponse.json({ ok: true, pts: 0 });

  if (action === "login") {
    const today = new Date().toISOString().slice(0, 10);
    const { data: vendor } = await supabase.from("vendors").select("last_score_login").eq("id", vendor_id).single();
    if (vendor?.last_score_login === today) return NextResponse.json({ ok: true, pts: 0, skipped: true });
    await supabase.rpc("increment_local_score", { vendor_id_in: vendor_id, pts_in: pts });
    await supabase.from("vendors").update({ last_score_login: today }).eq("id", vendor_id);
  } else if (action === "sale") {
    await supabase.rpc("increment_products_sold", { vendor_id_in: vendor_id });
  } else {
    await supabase.rpc("increment_local_score", { vendor_id_in: vendor_id, pts_in: pts });
  }

  return NextResponse.json({ ok: true, pts });
}
