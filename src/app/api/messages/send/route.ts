import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendPushToUser } from "@/lib/push";

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? "placeholder"); }
function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ADMIN_EMAIL = "dryarrington@gmail.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversation_id, body, buyer_name } = await req.json();
  if (!conversation_id || !body?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // ── Duplicate check ──────────────────────────────────────────────
  const { data: dupeType, error: checkErr } = await supabase.rpc("check_message_duplicate", {
    sender_id_in: user.id,
    conversation_id_in: conversation_id,
    body_in: body.trim(),
  });

  let flagId: string | null = null;

  if (!checkErr && dupeType && dupeType !== "ok") {
    const admin = getAdmin();

    // Get sender profile for notification detail
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const label = dupeType === "cross_vendor"
      ? "Copy-pasted to multiple vendors"
      : "Repeated in same conversation";

    // Write flag
    const { data: flag } = await admin.from("spam_flags").insert({
      type: "message_duplicate",
      flagged_user_id: user.id,
      details: {
        conversation_id,
        message_preview: body.trim().slice(0, 120),
        duplicate_type: dupeType,
        sender_name: profile?.full_name ?? "Unknown",
        sender_email: profile?.email ?? user.email,
      },
      status: "open",
    }).select("id").single();

    flagId = flag?.id ?? null;

    // Email admin
    try {
      const resend = getResend();
      await resend.emails.send({
        from: "Everything Local <alerts@everythinglocal.org>",
        to: ADMIN_EMAIL,
        subject: `⚠️ Duplicate Message Detected`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#dc2626;margin:0 0 16px">⚠️ Duplicate Message Flag</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px">Type</td><td style="font-weight:600">${label}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">User</td><td>${profile?.full_name ?? "Unknown"} (${profile?.email ?? user.email})</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Message</td><td style="font-style:italic">"${body.trim().slice(0, 120)}${body.length > 120 ? "…" : ""}"</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Flag ID</td><td style="font-size:11px;color:#9ca3af">${flagId}</td></tr>
            </table>
            <a href="https://hyperlocal-marketplace-ochre.vercel.app/admin" style="display:inline-block;margin-top:20px;background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">Review in Admin Panel →</a>
          </div>
        `,
      });
    } catch { /* email failure shouldn't block the message */ }
  }

  // ── Insert message regardless (flag is for review, not a hard block) ──
  const { data: message, error: insertErr } = await supabase
    .from("messages")
    .insert({
      conversation_id,
      sender_id: user.id,
      body: body.trim(),
    })
    .select("*")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Update conversation preview
  await supabase.from("conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: body.trim().slice(0, 100),
  }).eq("id", conversation_id);

  // ── Push the other party (best-effort; never blocks the message) ─────────
  try {
    const admin = getAdmin();
    const { data: convo } = await admin
      .from("conversations")
      .select("buyer_id, vendor_id, vendor:vendors(business_name, user_id)")
      .eq("id", conversation_id)
      .single();

    if (convo) {
      const vendor = Array.isArray(convo.vendor) ? convo.vendor[0] : convo.vendor;
      const senderIsBuyer = convo.buyer_id === user.id;
      const recipientId = senderIsBuyer ? vendor?.user_id : convo.buyer_id;

      if (recipientId && recipientId !== user.id) {
        let senderName = senderIsBuyer ? (buyer_name as string | undefined) : vendor?.business_name;
        if (!senderName) {
          const { data: me } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
          senderName = me?.full_name ?? "Someone";
        }
        await sendPushToUser(recipientId, {
          title: `💬 ${senderName}`,
          body: body.trim().slice(0, 120),
          url: senderIsBuyer ? "/dashboard/vendor?tab=messages" : "/dashboard/buyer?tab=messages",
          tag: `msg-${conversation_id}`,   // one badge per conversation
        });
      }
    }
  } catch { /* push is best-effort */ }

  return NextResponse.json({ message, flagged: !!flagId, flag_type: dupeType });
}
