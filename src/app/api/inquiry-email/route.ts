import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { vendorId, buyerName, buyerEmail, buyerPhone, message, inquiryType } = await req.json();

  const supabaseAdmin = getSupabaseAdmin();
  const { data: vendor } = await supabaseAdmin
    .from("vendors")
    .select("business_name, user_id, slug")
    .eq("id", vendorId)
    .single();

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const typeLabel: Record<string, string> = {
    general: "General Inquiry",
    estimate: "Free Estimate Request",
    order: "Order Inquiry",
    call: "Call Request",
    cta: "Contact Form",
  };
  const label = typeLabel[inquiryType] ?? "New Inquiry";

  // ── Add the lead to the vendor's CRM (dedupe by email or phone) ──────────
  try {
    let existing: { id: string } | null = null;
    if (buyerEmail) {
      const { data } = await supabaseAdmin
        .from("crm_contacts").select("id").eq("vendor_id", vendorId).eq("email", buyerEmail).limit(1).maybeSingle();
      existing = data;
    }
    if (!existing && buyerPhone) {
      const { data } = await supabaseAdmin
        .from("crm_contacts").select("id").eq("vendor_id", vendorId).eq("phone", buyerPhone).limit(1).maybeSingle();
      existing = data;
    }
    if (!existing) {
      await supabaseAdmin.from("crm_contacts").insert({
        vendor_id: vendorId,
        name: buyerName,
        email: buyerEmail || null,
        phone: buyerPhone || null,
        source: inquiryType === "estimate" ? "estimate" : "inquiry",
        notes: message || null,
      });
    }
  } catch { /* CRM insert is best-effort; never block the inquiry */ }

  // ── Notify the business owner in-app + push ─────────────────────────────
  if (vendor.user_id) {
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: vendor.user_id,
        type: "inquiry",
        title: `${label} from ${buyerName}`,
        body: message?.slice(0, 200) ?? null,
        link: "/dashboard/vendor",
      });
    } catch { /* best-effort */ }
    await sendPushToUser(vendor.user_id, {
      title: `${label} from ${buyerName}`,
      body: message?.slice(0, 120) ?? "Open your dashboard to reply.",
      url: "/dashboard/vendor",
      tag: "inquiry",
    });
  }

  const { data: { user } } = vendor.user_id
    ? await supabaseAdmin.auth.admin.getUserById(vendor.user_id)
    : { data: { user: null } };
  const vendorEmail = user?.email;
  if (!vendorEmail) return NextResponse.json({ ok: true }); // no email on file, CRM+notification already saved

  const resend = getResend();
  await resend.emails.send({
    from: "EverythingLocal <bookings@everythinglocal.org>",
    to: vendorEmail,
    subject: `${label} from ${buyerName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #111827; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 20px;">📩 ${label}</h1>
        </div>
        <div style="background: #f9fafb; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">
            Hi <strong>${vendor.business_name}</strong>, you have a new inquiry through your Everything Local profile.
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280; width: 35%;">Name</td>
              <td style="padding: 10px 0; font-weight: 600;">${buyerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Email</td>
              <td style="padding: 10px 0;"><a href="mailto:${buyerEmail}" style="color: #16a34a;">${buyerEmail}</a></td>
            </tr>
            ${buyerPhone ? `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Phone</td>
              <td style="padding: 10px 0;"><a href="tel:${buyerPhone}" style="color: #16a34a;">${buyerPhone}</a></td>
            </tr>` : ""}
            <tr>
              <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Message</td>
              <td style="padding: 10px 0;">${message.replace(/\n/g, "<br>")}</td>
            </tr>
          </table>
          <a href="https://hyperlocal-marketplace-ochre.vercel.app/dashboard/vendor" style="display: inline-block; background: #111827; color: white; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            View in Dashboard →
          </a>
        </div>
        <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">EverythingLocal · Connecting your neighborhood</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
