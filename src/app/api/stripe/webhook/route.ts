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
        await supabase
          .from("vendors")
          .update({ tier: "premium", stripe_subscription_id: session.subscription as string })
          .eq("id", vendorId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const vendorId = sub.metadata?.vendor_id;
      if (vendorId) {
        const isActive = sub.status === "active" || sub.status === "trialing";
        await supabase
          .from("vendors")
          .update({ tier: isActive ? "premium" : "free" })
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
        await supabase
          .from("vendors")
          .update({ stripe_connect_enabled: true })
          .eq("id", account.metadata.vendor_id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
