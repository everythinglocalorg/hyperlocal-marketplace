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

// Deduct any Local Bucks the buyer applied — only after payment clears.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function spendLb(supabase: any, userId: string | undefined, lbStr: string | undefined, referenceId: string, reason: string) {
  const lb = parseInt(lbStr ?? "0", 10);
  if (lb > 0 && userId) {
    await supabase.rpc("spend_local_bucks", {
      p_user_id: userId,
      p_amount: lb,
      p_reason: reason,
      p_reference_id: referenceId,
      p_reference_type: reason,
    });
  }
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
      // Job listing paid → publish it and store its subscription.
      if (session.metadata?.type === "job_post" && session.metadata?.job_id) {
        await supabase
          .from("jobs")
          .update({ is_active: true, stripe_subscription_id: session.subscription as string })
          .eq("id", session.metadata.job_id);
        await spendLb(supabase, session.metadata.user_id, session.metadata.lb, session.metadata.job_id, "job");
        break;
      }
      // Place listing paid (attraction / thing_to_do / food_truck) → publish.
      if (session.metadata?.type === "place_post" && session.metadata?.place_id) {
        await supabase
          .from("places")
          .update({ is_active: true, stripe_subscription_id: session.subscription as string })
          .eq("id", session.metadata.place_id);
        break;
      }
      // Boost paid → activate the feature placement.
      if (session.metadata?.type === "boost" && session.metadata?.boost_id) {
        await supabase
          .from("featured_boosts")
          .update({ is_active: true, stripe_subscription_id: session.subscription as string })
          .eq("id", session.metadata.boost_id);
        await spendLb(supabase, session.metadata.user_id, session.metadata.lb, session.metadata.boost_id, "boost");
        break;
      }
      const vendorId = session.metadata?.vendor_id;
      if (vendorId) {
        // A real paid upgrade auto-grants the Local Verified badge.
        await supabase
          .from("vendors")
          .update({ tier: "premium", is_verified: true, stripe_subscription_id: session.subscription as string })
          .eq("id", vendorId);
        await spendLb(supabase, session.metadata.user_id, session.metadata.lb, vendorId, "membership");
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
      // Job listing subscription ended (canceled or lapsed) → take the job down.
      if (sub.metadata?.type === "job_post" && sub.metadata?.job_id) {
        await supabase
          .from("jobs")
          .update({ is_active: false })
          .eq("id", sub.metadata.job_id);
        break;
      }
      // Place listing subscription ended → take the place down.
      if (sub.metadata?.type === "place_post" && sub.metadata?.place_id) {
        await supabase
          .from("places")
          .update({ is_active: false })
          .eq("id", sub.metadata.place_id);
        break;
      }
      // Boost subscription ended → drop the feature placement.
      if (sub.metadata?.type === "boost" && sub.metadata?.boost_id) {
        await supabase
          .from("featured_boosts")
          .update({ is_active: false })
          .eq("id", sub.metadata.boost_id);
        break;
      }
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
