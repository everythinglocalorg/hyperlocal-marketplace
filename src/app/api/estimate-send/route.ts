import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { Resend } from "resend";

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? "placeholder"); }
function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type LineItem = { description: string; qty: number; unit_price: number };

function money(n: number) { return `$${n.toFixed(2)}`; }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { estimateId, channel } = await req.json();
  if (!estimateId || !["email", "internal"].includes(channel)) {
    return NextResponse.json({ error: "Missing estimateId or channel" }, { status: 400 });
  }

  const admin = getAdmin();

  // Load estimate + its vendor, and verify the caller owns that vendor
  const { data: est } = await admin
    .from("estimates")
    .select("*, vendor:vendors(id, business_name, user_id)")
    .eq("id", estimateId)
    .single();
  if (!est) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });

  const vendor = Array.isArray(est.vendor) ? est.vendor[0] : est.vendor;
  if (!vendor || vendor.user_id !== user.id) {
    return NextResponse.json({ error: "Not your estimate" }, { status: 403 });
  }

  const lineItems: LineItem[] = Array.isArray(est.line_items) ? est.line_items : [];
  const total = lineItems.reduce((s, li) => s + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  const customerName = est.customer_name ?? "there";

  // Ensure a public share token so the recipient can open the live proposal
  // (view, toggle options, accept, and pay the deposit).
  let shareToken: string = est.share_token ?? "";
  if (!shareToken) {
    shareToken = crypto.randomUUID().replace(/-/g, "");
    await admin.from("estimates").update({ share_token: shareToken }).eq("id", est.id);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://everythinglocal.shop";
  const proposalUrl = `${appUrl}/proposal/${shareToken}`;

  // ── EMAIL THE CUSTOMER ────────────────────────────────────────────────
  if (channel === "email") {
    if (!est.customer_email) {
      return NextResponse.json({ error: "No customer email on this estimate" }, { status: 400 });
    }
    const rows = lineItems.map((li) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${li.description || "—"}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${li.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(Number(li.unit_price) || 0)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money((Number(li.qty) || 0) * (Number(li.unit_price) || 0))}</td>
      </tr>`).join("");

    const resend = getResend();
    await resend.emails.send({
      from: "EverythingLocal <bookings@everythinglocal.org>",
      to: est.customer_email,
      subject: `Estimate from ${vendor.business_name}: ${est.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#111827;padding:24px 32px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:white;font-size:20px;">${est.title}</h1>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Estimate from ${vendor.business_name}</p>
          </div>
          <div style="background:#f9fafb;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
            <p style="font-size:15px;">Hi ${customerName}, here is your estimate:</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
              <tr style="border-bottom:2px solid #e5e7eb;">
                <th style="text-align:left;padding:8px 0;">Description</th>
                <th style="text-align:center;padding:8px 0;">Qty</th>
                <th style="text-align:right;padding:8px 0;">Unit</th>
                <th style="text-align:right;padding:8px 0;">Total</th>
              </tr>
              ${rows}
            </table>
            <p style="text-align:right;font-size:18px;font-weight:700;color:#16a34a;">Total: ${money(total)}</p>
            <div style="text-align:center;margin:20px 0 4px;">
              <a href="${proposalUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;">View &amp; Accept Proposal →</a>
            </div>
            <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:6px;">Review the full proposal, choose any options, and pay your deposit online.</p>
            ${est.notes ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:13px;color:#374151;white-space:pre-line;">${est.notes}</div>` : ""}
          </div>
          <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">EverythingLocal · Connecting your neighborhood</p>
        </div>`,
    });

    await admin.from("estimates").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", est.id);
    return NextResponse.json({ ok: true, channel: "email" });
  }

  // ── SEND AS AN IN-APP MESSAGE (customer must have an account) ──────────
  if (!est.customer_email) {
    return NextResponse.json({ error: "Add the customer's email so we can find their account" }, { status: 400 });
  }
  const { data: buyerProfile } = await admin
    .from("profiles").select("id").ilike("email", est.customer_email).maybeSingle();
  if (!buyerProfile) {
    return NextResponse.json({ error: "no_account" }, { status: 409 });
  }

  // Get-or-create a (vendor, buyer) conversation with no specific listing
  let conversationId: string | null = null;
  const { data: existing } = await admin
    .from("conversations").select("id")
    .eq("vendor_id", vendor.id).eq("buyer_id", buyerProfile.id).is("listing_id", null)
    .maybeSingle();
  conversationId = existing?.id ?? null;

  const preview = `Estimate: ${est.title} — ${money(total)}`;
  if (!conversationId) {
    const { data: convo } = await admin.from("conversations").insert({
      vendor_id: vendor.id, buyer_id: buyerProfile.id, listing_id: null,
      listing_title: est.title, last_message_preview: preview, last_message_at: new Date().toISOString(),
      buyer_unread: 1,
    }).select("id").single();
    conversationId = convo?.id ?? null;
  } else {
    const { data: c } = await admin.from("conversations").select("buyer_unread").eq("id", conversationId).single();
    await admin.from("conversations").update({
      last_message_preview: preview, last_message_at: new Date().toISOString(),
      buyer_unread: (c?.buyer_unread ?? 0) + 1,
    }).eq("id", conversationId);
  }
  if (!conversationId) return NextResponse.json({ error: "Could not open conversation" }, { status: 500 });

  const lines = lineItems.map((li) => `• ${li.description || "—"} × ${li.qty} @ ${money(Number(li.unit_price) || 0)}`).join("\n");
  const body = `📋 Estimate: ${est.title}\n\n${lines}\n\nTotal: ${money(total)}${est.notes ? `\n\nNotes: ${est.notes}` : ""}\n\nView & accept your proposal: ${proposalUrl}`;

  await admin.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
  await admin.from("estimates").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", est.id);

  return NextResponse.json({ ok: true, channel: "internal", conversationId });
}
