import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  verifyDomain,
  getDomainStatus,
  dnsInstructionsFor,
  vercelConfigured,
} from "@/lib/vercel";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Re-check DNS/verification for any vendor's domain (admin only).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!vercelConfigured())
    return NextResponse.json({ error: "Domain hosting not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : null;
  if (!vendorId)
    return NextResponse.json({ error: "vendorId is required." }, { status: 400 });

  const db = service();
  const { data: vendor } = await db
    .from("vendors")
    .select("custom_domain, domain_verified")
    .eq("id", vendorId)
    .single();
  if (!vendor?.custom_domain)
    return NextResponse.json({ error: "No domain connected." }, { status: 400 });

  const domain = vendor.custom_domain as string;
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
    await db.from("vendors").update({ domain_verified: verified }).eq("id", vendorId);
  }

  return NextResponse.json({ domain, verified, misconfigured, dns: dnsInstructionsFor(domain) });
}
