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

const ADMIN_EMAIL = "dryarrington@gmail.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor_id, title } = await req.json();
  if (!vendor_id || !title?.trim()) {
    return NextResponse.json({ isDuplicate: false });
  }

  const { data: isDuplicate } = await supabase.rpc("check_listing_duplicate", {
    vendor_id_in: vendor_id,
    title_in: title.trim(),
  });

  if (isDuplicate) {
    const admin = getAdmin();
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
    const { data: vendor } = await supabase.from("vendors").select("business_name").eq("id", vendor_id).single();

    await admin.from("spam_flags").insert({
      type: "listing_duplicate",
      flagged_user_id: user.id,
      vendor_id,
      details: {
        title: title.trim(),
        business_name: vendor?.business_name ?? "Unknown",
        sender_name: profile?.full_name ?? "Unknown",
        sender_email: profile?.email ?? user.email,
      },
      status: "open",
    });

    try {
      const resend = getResend();
      await resend.emails.send({
        from: "Everything Local <alerts@everythinglocal.org>",
        to: ADMIN_EMAIL,
        subject: `⚠️ Duplicate Listing Attempt`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#dc2626;margin:0 0 16px">⚠️ Duplicate Listing Blocked</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px">Business</td><td style="font-weight:600">${vendor?.business_name ?? "Unknown"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">User</td><td>${profile?.full_name ?? "Unknown"} (${profile?.email ?? user.email})</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Title</td><td style="font-style:italic">"${title.trim()}"</td></tr>
            </table>
            <a href="https://hyperlocal-marketplace-ochre.vercel.app/admin" style="display:inline-block;margin-top:20px;background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">Review in Admin Panel →</a>
          </div>
        `,
      });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ isDuplicate: !!isDuplicate });
}
