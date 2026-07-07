import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Cancel a job's $5/month subscription and remove the listing. Called when the
// poster deletes their job so they stop being billed for a listing that's gone.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

    const { data: job } = await supabase
      .from("jobs")
      .select("id, user_id, stripe_subscription_id")
      .eq("id", job_id)
      .single();
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(job.stripe_subscription_id);
      } catch (e) {
        // Already canceled / not found — safe to continue with the delete.
        console.error("Job subscription cancel failed:", e instanceof Error ? e.message : e);
      }
    }

    // RLS lets the owner delete their own job.
    const { error } = await supabase.from("jobs").delete().eq("id", job_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Job cancel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
