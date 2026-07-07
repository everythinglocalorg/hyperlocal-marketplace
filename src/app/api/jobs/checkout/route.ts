import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// $5/month keeps a job listing live. The card is saved automatically (Stripe
// subscription) so it renews and can be reused for future off-session billing.
const JOB_POST_PRICE_CENTS = 500;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

    // The job must be a draft owned by this user (created just before checkout).
    const { data: job } = await supabase
      .from("jobs")
      .select("id, user_id, city_slug")
      .eq("id", job_id)
      .single();
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Reuse or create the user's Stripe customer (stored on their profile).
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hyperlocal-marketplace-ochre.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: "Everything Local — Job listing" },
          unit_amount: JOB_POST_PRICE_CENTS,
          recurring: { interval: "month" },
        },
      }],
      // metadata drives the webhook: activate this job once paid.
      metadata: { type: "job_post", job_id: job.id, user_id: user.id },
      subscription_data: { metadata: { type: "job_post", job_id: job.id, user_id: user.id } },
      success_url: `${appUrl}/jobs/${job.city_slug}?posted=1`,
      cancel_url: `${appUrl}/jobs/${job.city_slug}?post_cancelled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Job checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
