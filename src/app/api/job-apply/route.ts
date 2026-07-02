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
  const { jobId, applicantName, applicantEmail, applicantPhone, message } = await req.json();

  if (!jobId || !applicantName || !applicantEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, title, user_id, vendor_id, contact_email, city, state, city_slug")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // ── If a business posted it, add the applicant to their CRM (dedupe) ─────
  if (job.vendor_id) {
    try {
      let existing: { id: string } | null = null;
      const { data } = await supabaseAdmin
        .from("crm_contacts").select("id").eq("vendor_id", job.vendor_id).eq("email", applicantEmail).limit(1).maybeSingle();
      existing = data;
      if (!existing && applicantPhone) {
        const { data: byPhone } = await supabaseAdmin
          .from("crm_contacts").select("id").eq("vendor_id", job.vendor_id).eq("phone", applicantPhone).limit(1).maybeSingle();
        existing = byPhone;
      }
      if (!existing) {
        await supabaseAdmin.from("crm_contacts").insert({
          vendor_id: job.vendor_id,
          name: applicantName,
          email: applicantEmail,
          phone: applicantPhone || null,
          source: "inquiry",
          notes: `Applied for job: ${job.title}${message ? ` — ${message}` : ""}`,
        });
      }
    } catch { /* CRM insert is best-effort; never block the application */ }
  }

  // ── Notify the poster in-app ─────────────────────────────────────────────
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: job.user_id,
      type: "inquiry",
      title: `New applicant for "${job.title}"`,
      body: `${applicantName} · ${applicantEmail}${applicantPhone ? ` · ${applicantPhone}` : ""}${message ? ` — ${String(message).slice(0, 140)}` : ""}`,
      link: `/jobs/${job.city_slug}`,
    });
  } catch { /* best-effort */ }

  // ── Email the poster (job contact email, else their account email) ───────
  let toEmail: string | null = job.contact_email ?? null;
  if (!toEmail && job.user_id) {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(job.user_id);
    toEmail = user?.email ?? null;
  }
  if (!toEmail) return NextResponse.json({ ok: true }); // notification already saved

  const resend = getResend();
  await resend.emails.send({
    from: "EverythingLocal <bookings@everythinglocal.org>",
    to: toEmail,
    subject: `New applicant for "${job.title}" — ${applicantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #111827; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 20px;">💼 New Job Application</h1>
        </div>
        <div style="background: #f9fafb; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">
            Someone applied to your job posting <strong>${job.title}</strong> in ${job.city}${job.state ? `, ${job.state}` : ""} on Everything Local.
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280; width: 35%;">Name</td>
              <td style="padding: 10px 0; font-weight: 600;">${applicantName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Email</td>
              <td style="padding: 10px 0;"><a href="mailto:${applicantEmail}" style="color: #16a34a;">${applicantEmail}</a></td>
            </tr>
            ${applicantPhone ? `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; color: #6b7280;">Phone</td>
              <td style="padding: 10px 0;"><a href="tel:${applicantPhone}" style="color: #16a34a;">${applicantPhone}</a></td>
            </tr>` : ""}
            ${message ? `
            <tr>
              <td style="padding: 10px 0; color: #6b7280; vertical-align: top;">Message</td>
              <td style="padding: 10px 0;">${String(message).replace(/\n/g, "<br>")}</td>
            </tr>` : ""}
          </table>
          <a href="https://hyperlocal-marketplace-ochre.vercel.app/jobs/${job.city_slug}" style="display: inline-block; background: #111827; color: white; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            View Jobs Board →
          </a>
        </div>
        <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">EverythingLocal · Connecting your neighborhood</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
