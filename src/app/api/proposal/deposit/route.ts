import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { Area, Addon, DepositType, selectedTotal, depositAmount, defaultSelectedAddonIds } from "@/lib/estimate-pricing";

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Public: a customer on /proposal/[token] pays the deposit by card. Funds route
// 100% to the vendor's connected Express account (destination charge, no fee).
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 500 });
  }

  const { token, optionalAreaIds, addonIds } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Missing proposal token" }, { status: 400 });

  const admin = getAdmin();
  const { data: est } = await admin
    .from("estimates")
    .select("*, vendor:vendors(id, business_name, stripe_connect_account_id, stripe_connect_enabled)")
    .eq("share_token", token)
    .maybeSingle();
  if (!est) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const vendor = Array.isArray(est.vendor) ? est.vendor[0] : est.vendor;
  if (!vendor?.stripe_connect_account_id || !vendor?.stripe_connect_enabled) {
    return NextResponse.json({ error: "This business isn't set up to take card payments yet. Please pay by check or contact them." }, { status: 409 });
  }
  if (!Array.isArray(est.payment_methods) || !est.payment_methods.includes("card")) {
    return NextResponse.json({ error: "Card payment isn't enabled on this proposal." }, { status: 409 });
  }

  // Authoritative recompute — never trust an amount from the browser.
  const areas: Area[] = Array.isArray(est.areas) ? est.areas : [];
  const addons: Addon[] = Array.isArray(est.addons) ? est.addons : [];
  const optAreaSet = new Set<string>(Array.isArray(optionalAreaIds) ? optionalAreaIds : []);
  const addonSet = new Set<string>(Array.isArray(addonIds) ? addonIds : defaultSelectedAddonIds(addons));

  const total = selectedTotal(areas, addons, optAreaSet, addonSet);
  const deposit = depositAmount(total, (est.deposit_type as DepositType) ?? "percent", Number(est.deposit_value) ?? 50);
  const depositCents = Math.round(deposit * 100);
  if (depositCents < 50) {
    return NextResponse.json({ error: "Deposit amount is too small to charge." }, { status: 400 });
  }

  // Persist the customer's selections so the webhook can finalize acceptance.
  await admin.from("estimates").update({
    customer_selections: { optional_area_ids: Array.from(optAreaSet), addon_ids: Array.from(addonSet) },
  }).eq("id", est.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `Deposit — ${est.title}`, description: `${vendor.business_name}` },
        unit_amount: depositCents,
      },
      quantity: 1,
    }],
    ...(est.customer_email ? { customer_email: est.customer_email } : {}),
    payment_intent_data: {
      description: `Deposit for ${est.title}`,
      transfer_data: { destination: vendor.stripe_connect_account_id },
      metadata: { type: "proposal_deposit", estimate_id: est.id, token },
    },
    success_url: `${appUrl}/proposal/${token}?paid=1`,
    cancel_url: `${appUrl}/proposal/${token}?cancelled=1`,
    metadata: { type: "proposal_deposit", estimate_id: est.id, token },
  });

  return NextResponse.json({ url: session.url });
}
