import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Invite an off-platform neighbor to a business by email. The reward + CRM lead
// + anti-abuse caps run in the refer_to_vendor_email RPC (as the signed-in user);
// this route just fires the actual invite email afterward.
export async function POST(req: NextRequest) {
  const { vendorId, name, email } = await req.json();

  const trimmedEmail = (email ?? "").trim().toLowerCase();
  if (!vendorId || !trimmedEmail || !trimmedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // Must be signed in — the RPC rewards auth.uid(), never a trusted param.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in to refer a friend." }, { status: 401 });

  // Record the referral (CRM lead + Local Bucks, with the daily caps enforced).
  const { data: status, error } = await supabase.rpc("refer_to_vendor_email", {
    p_vendor_id: vendorId,
    p_name: name ?? null,
    p_email: trimmedEmail,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Already invited before → don't send a duplicate email.
  if (status === "already") return NextResponse.json({ status });

  // ── Send the invite email (best-effort; the referral is already recorded) ──
  try {
    const admin = getSupabaseAdmin();
    const [{ data: vendor }, { data: referrer }] = await Promise.all([
      admin.from("vendors").select("business_name, slug, city, state").eq("id", vendorId).single(),
      admin.from("profiles").select("full_name, referral_code").eq("id", user.id).single(),
    ]);

    if (vendor) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://everythinglocal.org";
      const refCode = referrer?.referral_code ?? "";
      // Land on the business, tagged with the referrer's code so the invitee's
      // eventual signup also credits the referrer (20 LB on signup).
      const link = `${appUrl}/vendors/${vendor.slug}${refCode ? `?ref=${refCode}` : ""}`;
      const fromName = referrer?.full_name?.trim() || "A neighbor";
      const where = vendor.city ? ` in ${vendor.city}${vendor.state ? `, ${vendor.state}` : ""}` : "";

      await getResend().emails.send({
        from: "EverythingLocal <bookings@everythinglocal.org>",
        to: trimmedEmail,
        subject: `${fromName} thinks you'd love ${vendor.business_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #16a34a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 20px;">🤝 A local recommendation for you</h1>
            </div>
            <div style="background: #f9fafb; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                <strong>${fromName}</strong> wanted you to know about
                <strong>${vendor.business_name}</strong>${where} on Everything Local —
                the place to discover and support local businesses in your neighborhood.
              </p>
              <a href="${link}" style="display: inline-block; background: #16a34a; color: white; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                Check out ${vendor.business_name} →
              </a>
              <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280;">
                New to Everything Local? Create a free account to message local businesses,
                book, and earn Local Bucks rewards.
              </p>
            </div>
            <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">EverythingLocal · Connecting your neighborhood</p>
          </div>
        `,
      });
    }
  } catch { /* email is best-effort — the referral + reward are already saved */ }

  return NextResponse.json({ status });
}
