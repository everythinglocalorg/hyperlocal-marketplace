import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  verifyDomain,
  getDomainStatus,
  dnsInstructionsFor,
  vercelConfigured,
} from "@/lib/vercel";

// Re-check whether the vendor's DNS is in place yet, and flip domain_verified
// once Vercel confirms it. The dashboard calls this from the "Verify" button.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, custom_domain, domain_verified")
    .eq("user_id", user.id)
    .single();

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  if (!vendor.custom_domain)
    return NextResponse.json({ error: "No domain connected." }, { status: 400 });
  if (!vercelConfigured())
    return NextResponse.json({ error: "Domain hosting not configured." }, { status: 503 });

  const domain = vendor.custom_domain as string;

  // Ask Vercel to re-run verification, then read current status.
  await verifyDomain(domain).catch(() => {});
  let verified = false;
  let misconfigured = true;
  try {
    const status = await getDomainStatus(domain);
    verified = status.verified && !status.misconfigured;
    misconfigured = status.misconfigured;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 502 }
    );
  }

  if (verified !== vendor.domain_verified) {
    await supabase
      .from("vendors")
      .update({ domain_verified: verified })
      .eq("id", vendor.id);
  }

  return NextResponse.json({
    domain,
    verified,
    misconfigured,
    dns: dnsInstructionsFor(domain),
  });
}
