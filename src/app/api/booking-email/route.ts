import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { vendorId, customerName, listingTitle, date, time, duration, price, notes } = await req.json();

  // Look up vendor name + email via service role (bypasses RLS)
  const { data: vendor } = await supabaseAdmin
    .from("vendors")
    .select("business_name, user_id")
    .eq("id", vendorId)
    .single();

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(vendor.user_id);
  const vendorEmail = user?.email;

  if (!vendorEmail) return NextResponse.json({ error: "No vendor email" }, { status: 400 });

  const { error } = await resend.emails.send({
    from: "EverythingLocal <bookings@everythinglocal.org>",
    to: vendorEmail,
    subject: `New Rental Request: ${listingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #16a34a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 22px;">📅 New Rental Booking Request</h1>
        </div>
        <div style="background: #f9fafb; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">
            Hi <strong>${vendor.business_name}</strong>, you have a new booking request for <strong>${listingTitle}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280; width: 40%;">Customer</td>
              <td style="padding: 10px 0; font-weight: 600;">${customerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Listing</td>
              <td style="padding: 10px 0; font-weight: 600;">${listingTitle}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Date</td>
              <td style="padding: 10px 0; font-weight: 600;">${date}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Start Time</td>
              <td style="padding: 10px 0; font-weight: 600;">${time}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Duration</td>
              <td style="padding: 10px 0; font-weight: 600;">${duration}</td>
            </tr>
            <tr style="${notes ? "border-bottom: 1px solid #e5e7eb;" : ""}">
              <td style="padding: 10px 0; color: #6b7280;">Total</td>
              <td style="padding: 10px 0; font-weight: 700; color: #16a34a; font-size: 16px;">${price}</td>
            </tr>
            ${notes ? `
            <tr>
              <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Notes</td>
              <td style="padding: 10px 0;">${notes}</td>
            </tr>` : ""}
          </table>

          <p style="font-size: 13px; color: #6b7280; margin: 0;">
            The customer has signed the rental waiver electronically. Log in to your vendor dashboard to confirm or cancel this booking.
          </p>
        </div>
        <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">EverythingLocal · Connecting your neighborhood</p>
      </div>
    `,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
