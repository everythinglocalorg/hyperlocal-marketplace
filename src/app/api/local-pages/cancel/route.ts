import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Cancel a paid Local Pages post's $5/month subscription and remove it (plus its
// cross-posted job, if any). Called when the business deletes the post so they
// stop being billed. Mirrors /api/jobs/cancel.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { post_id } = await req.json();
    if (!post_id) return NextResponse.json({ error: "Missing post_id" }, { status: 400 });

    const { data: post } = await supabase
      .from("community_posts")
      .select("id, user_id, stripe_subscription_id, linked_job_id")
      .eq("id", post_id)
      .single();
    if (!post || post.user_id !== user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(post.stripe_subscription_id);
      } catch (e) {
        // Already canceled / not found — safe to continue with the delete.
        console.error("Local Pages subscription cancel failed:", e instanceof Error ? e.message : e);
      }
    }

    // Remove the cross-posted job first (owner RLS lets them delete their own).
    if (post.linked_job_id) {
      await supabase.from("jobs").delete().eq("id", post.linked_job_id);
    }

    const { error } = await supabase.from("community_posts").delete().eq("id", post_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Local Pages cancel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
