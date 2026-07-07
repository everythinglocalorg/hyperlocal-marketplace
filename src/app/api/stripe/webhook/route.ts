import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
// Use service role so webhook can bypass RLS
function adminSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const vendorId = session.metadata?.vendor_id;
      if (vendorId) {
        // A real paid upgrade auto-grants the Local Verified badge.
        await supabase
          .from("vendors")
          .update({ tier: "premium", is_verified: true, stripe_subscription_id: session.subscription as string })
          .eq("id", vendorId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const vendorId = sub.metadata?.vendor_id;
      if (vendorId) {
        const isActive = sub.status === "active" || sub.status === "trialing";
        // Grant Verified while a paid subscription is active; never auto-revoke
        // (an admin may have verified them manually — only admins un-verify).
        await supabase
          .from("vendors")
          .update(isActive ? { tier: "premium", is_verified: true } : { tier: "free" })
          .eq("id", vendorId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const vendorId = sub.metadata?.vendor_id;
      if (vendorId) {
        await supabase
          .from("vendors")
          .update({ tier: "free", stripe_subscription_id: null })
          .eq("id", vendorId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const sub = invoice.subscription;
      if (sub) {
        const subscription = await stripe.subscriptions.retrieve(sub as string);
        const vendorId = subscription.metadata?.vendor_id;
        if (vendorId) {
          await supabase
            .from("vendors")
            .update({ tier: "free" })
            .eq("id", vendorId);
        }
      }
      break;
    }

    // Connect account fully onboarded
    case "account.updated": {
      const account = event.data.object;
      if (
        account.charges_enabled &&
        account.details_submitted &&
        account.metadata?.vendor_id
      ) {
        const vendorId = account.metadata.vendor_id;
        await supabase
          .from("vendors")
          .update({ stripe_connect_enabled: true })
          .eq("id", vendorId);

        // One-time 10 LB reward for connecting Stripe payouts
        // (account.updated fires repeatedly; the ledger check keeps it single).
        const { data: vendorRow } = await supabase
          .from("vendors")
          .select("user_id")
          .eq("id", vendorId)
          .single();
        if (vendorRow?.user_id) {
          const { data: prior } = await supabase
            .from("local_bucks_transactions")
            .select("id")
            .eq("user_id", vendorRow.user_id)
            .eq("reason", "connect_stripe")
            .limit(1);
          if (!prior?.length) {
            await supabase.rpc("award_local_bucks", {
              p_user_id: vendorRow.user_id,
              p_amount: 10,
              p_reason: "connect_stripe",
              p_reference_id: vendorId,
              p_reference_type: "vendor",
            });
          }
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
