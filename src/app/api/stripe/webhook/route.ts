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
      // Featured food truck paid → pin it to the top of its city board.
      if (session.metadata?.type === "food_truck_feature" && session.metadata?.vendor_id) {
        const vendorId = session.metadata.vendor_id as string;
        await supabase
          .from("vendors")
          .update({ food_truck_featured: true, food_truck_subscription_id: session.subscription as string })
          .eq("id", vendorId);
        await spendLb(supabase, session.metadata.user_id, session.metadata.lb, vendorId, "food_truck_feature");
        break;
      }
      // Place listing paid (attraction / thing_to_do) → publish.
      if (session.metadata?.type === "place_post" && session.metadata?.place_id) {
        await supabase
          .from("places")
          .update({ is_active: true, stripe_subscription_id: session.subscription as string })
          .eq("id", session.metadata.place_id);
        break;
      }
      // Proposal deposit paid → mark accepted + record payment.
      if (session.metadata?.type === "proposal_deposit" && session.metadata?.estimate_id) {
        await supabase
          .from("estimates")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            accepted_payment_method: "card",
            deposit_paid_at: new Date().toISOString(),
            deposit_payment_intent: (session.payment_intent as string) ?? null,
          })
          .eq("id", session.metadata.estimate_id);
        break;
      }
      // Rental deposit / full payment paid → record it on the booking.
      if (session.metadata?.type === "rental_deposit" && session.metadata?.booking_id) {
        await supabase
          .from("rental_bookings")
          .update({
            payment_status: session.metadata.full === "1" ? "paid" : "deposit_paid",
            deposit_paid_at: new Date().toISOString(),
            deposit_payment_intent: (session.payment_intent as string) ?? null,
          })
          .eq("id", session.metadata.booking_id);
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
      // Paid Local Loop business post (Hiring / Offer) → publish it.
      if (session.metadata?.type === "local_pages_post" && session.metadata?.post_id) {
        const postId = session.metadata.post_id as string;
        const { data: post } = await supabase
          .from("community_posts")
          .select("id, type, title, body, city, state, city_slug, user_id")
          .eq("id", postId)
          .single();
        await supabase
          .from("community_posts")
          .update({ is_active: true, stripe_subscription_id: session.subscription as string })
          .eq("id", postId);
        // A Hiring post cross-posts to the Local Jobs board (one posting, both places).
        if (post?.type === "hiring") {
          const { data: v } = await supabase
            .from("vendors").select("id").eq("user_id", post.user_id).limit(1).maybeSingle();
          const { data: job } = await supabase
            .from("jobs")
            .insert({
              user_id: post.user_id,
              vendor_id: v?.id ?? null,
              title: post.title,
              description: post.body,
              city: post.city,
              state: post.state,
              city_slug: post.city_slug,
              is_active: true,
              stripe_subscription_id: session.subscription as string,
            })
            .select("id")
            .single();
          if (job?.id) {
            await supabase.from("community_posts").update({ linked_job_id: job.id }).eq("id", postId);
          }
        }
        await spendLb(supabase, session.metadata.user_id, session.metadata.lb, postId, "local_pages_post");
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
      // Paid Local Loop post subscription ended → unpublish it (and its job).
      if (sub.metadata?.type === "local_pages_post" && sub.metadata?.post_id) {
        const postId = sub.metadata.post_id as string;
        const { data: p } = await supabase
          .from("community_posts").select("linked_job_id").eq("id", postId).single();
        await supabase.from("community_posts").update({ is_active: false }).eq("id", postId);
        if (p?.linked_job_id) {
          await supabase.from("jobs").update({ is_active: false }).eq("id", p.linked_job_id);
        }
        break;
      }
      // Featured food truck subscription ended → unpin it. The truck stays
      // listed for free; it just loses the featured spot.
      if (sub.metadata?.type === "food_truck_feature" && sub.metadata?.vendor_id) {
        await supabase
          .from("vendors")
          .update({ food_truck_featured: false, food_truck_subscription_id: null })
          .eq("id", sub.metadata.vendor_id);
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
