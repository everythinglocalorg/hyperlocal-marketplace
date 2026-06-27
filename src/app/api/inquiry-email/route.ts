import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

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
    .select("business_name, user_id")
    .eq("id", vendorId)
    .single();

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(vendor.user_id);
  const vendorEmail = user?.email;
  if (!vendorEmail) return NextResponse.json({ ok: true }); // no email on file, silently ok

  const typeLabel: Record<string, string> = {
    general: "General Inquiry",
    estimate: "Free Estimate Request",
    order: "Order Inquiry",
    call: "Call Request",
    cta: "Contact Form",
  };
  const label = typeLabel[inquiryType] ?? "New Inquiry";

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
