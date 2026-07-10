import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { Addon, defaultSelectedAddonIds } from "@/lib/estimate-pricing";

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Public: customer accepts the proposal and chooses to pay by check (no card
// charge). Records acceptance + their selections so the vendor sees it in CRM.
export async function POST(req: NextRequest) {
  const { token, lineIds, addonIds, method } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Missing proposal token" }, { status: 400 });

  const admin = getAdmin();
  const { data: est } = await admin
    .from("estimates")
    .select("id, addons, payment_methods")
    .eq("share_token", token)
    .maybeSingle();
  if (!est) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  // This endpoint only records the no-card path (pay by check on delivery).
  void method;
  if (!Array.isArray(est.payment_methods) || !est.payment_methods.includes("check")) {
    return NextResponse.json({ error: "Pay-by-check isn't enabled on this proposal." }, { status: 409 });
  }

  const addons: Addon[] = Array.isArray(est.addons) ? est.addons : [];
  const lineSel: string[] = Array.isArray(lineIds) ? lineIds : [];
  const addonSel: string[] = Array.isArray(addonIds) ? addonIds : defaultSelectedAddonIds(addons);

  await admin.from("estimates").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
    accepted_payment_method: "check",
    customer_selections: { line_ids: lineSel, addon_ids: addonSel },
  }).eq("id", est.id);

  return NextResponse.json({ ok: true });
}
