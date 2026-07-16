import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { computeLbDiscount } from "@/lib/lb-discount";

// $5/month keeps a business post (Hiring / Offer) live on Local Loop — the same
// fee and subscription model as a Local Jobs listing. Mirrors /api/jobs/checkout.
const POST_PRICE_CENTS = 500;
const PAID_TYPES = ["hiring", "offer"];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { post_id, apply_local_bucks } = await req.json();
    if (!post_id) return NextResponse.json({ error: "Missing post_id" }, { status: 400 });

    // The post must be a draft (is_active=false), owned by this user, of a paid type.
    const { data: post } = await supabase
      .from("community_posts")
      .select("id, user_id, city_slug, type, is_active")
      .eq("id", post_id)
      .single();
    if (!post || post.user_id !== user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (!PAID_TYPES.includes(post.type)) {
      return NextResponse.json({ error: "This post type is not a paid post" }, { status: 400 });
    }

    // Business gate: only vendor owners can post Hiring / Offer.
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!vendor) {
      return NextResponse.json({ error: "Only businesses can post this" }, { status: 403 });
    }

    // Reuse or create the user's Stripe customer (stored on their profile).
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name, local_bucks")
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

    // Local Bucks discount the first month (validated server-side).
    const charge = computeLbDiscount(POST_PRICE_CENTS, Number(apply_local_bucks) || 0, profile?.local_bucks ?? 0);
    let discounts: { coupon: string }[] | undefined;
    if (charge.discountCents > 0) {
      const coupon = await stripe.coupons.create({ amount_off: charge.discountCents, currency: "usd", duration: "once", max_redemptions: 1, name: `${charge.appliedLB} Local Bucks` });
      discounts = [{ coupon: coupon.id }];
    }

    const productName = post.type === "hiring"
      ? "Everything Local — Local Loop hiring post"
      : "Everything Local — Local Loop offer";
    const meta = { type: "local_pages_post", post_id: post.id, user_id: user.id, lb: String(charge.appliedLB) };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: productName },
          unit_amount: POST_PRICE_CENTS,
          recurring: { interval: "month" },
        },
      }],
      // metadata drives the webhook: publish this post once paid.
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${appUrl}/community/${post.city_slug}?posted=1`,
      cancel_url: `${appUrl}/community/${post.city_slug}?post_cancelled=1`,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Local Loop checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
