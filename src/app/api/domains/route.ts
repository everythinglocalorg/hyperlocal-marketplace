import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addDomainToProject,
  removeDomainFromProject,
  dnsInstructionsFor,
  vercelConfigured,
} from "@/lib/vercel";

// Basic hostname validation: bare domain, no protocol/path, at least one dot.
function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

async function getVendorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 };

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, slug, tier, custom_domain")
    .eq("user_id", user.id)
    .single();
  if (!vendor) return { error: "Vendor not found" as const, status: 404 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isPremium = vendor.tier === "premium" || profile?.is_admin === true;
  return { supabase, vendor, isPremium };
}

// Connect (or replace) a custom domain for the signed-in vendor.
export async function POST(request: Request) {
  const ctx = await getVendorContext();
  if ("error" in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, vendor, isPremium } = ctx;

  if (!isPremium) {
    return NextResponse.json(
      { error: "Custom domains are a Local Pro (premium) feature." },
      { status: 403 }
    );
  }
  if (!vercelConfigured()) {
    return NextResponse.json(
      { error: "Domain hosting is not configured yet. Contact support." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const domain = normalizeDomain(body.domain);
  if (!domain) {
    return NextResponse.json(
      { error: "Please enter a valid domain like joespizza.com" },
      { status: 400 }
    );
  }

  // If they already had a different domain, detach the old one first.
  if (vendor.custom_domain && vendor.custom_domain !== domain) {
    await removeDomainFromProject(vendor.custom_domain).catch(() => {});
  }

  try {
    await addDomainToProject(domain);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add domain" },
      { status: 400 }
    );
  }

  const { error: dbError } = await supabase
    .from("vendors")
    .update({
      custom_domain: domain,
      domain_verified: false,
      domain_added_at: new Date().toISOString(),
    })
    .eq("id", vendor.id);

  if (dbError) {
    // Roll back the Vercel attachment so we don't leave an orphan domain.
    await removeDomainFromProject(domain).catch(() => {});
    const taken = dbError.code === "23505"; // unique_violation
    return NextResponse.json(
      {
        error: taken
          ? "That domain is already connected to another store."
          : "Could not save domain.",
      },
      { status: taken ? 409 : 500 }
    );
  }

  return NextResponse.json({
    domain,
    verified: false,
    dns: dnsInstructionsFor(domain),
  });
}

// Disconnect the vendor's custom domain.
export async function DELETE() {
  const ctx = await getVendorContext();
  if ("error" in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, vendor } = ctx;

  if (vendor.custom_domain && vercelConfigured()) {
    await removeDomainFromProject(vendor.custom_domain).catch(() => {});
  }

  await supabase
    .from("vendors")
    .update({
      custom_domain: null,
      domain_verified: false,
      domain_added_at: null,
    })
    .eq("id", vendor.id);

  return NextResponse.json({ ok: true });
}
