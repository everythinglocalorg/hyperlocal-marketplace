import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  addDomainToProject,
  removeDomainFromProject,
  getDomainStatus,
  dnsInstructionsFor,
  wwwVariant,
  vercelConfigured,
} from "@/lib/vercel";

// Service-role client bypasses RLS so an admin can edit ANY vendor's row.
// (There is no admin RLS update policy on vendors, so a normal session write
// to another vendor would silently affect 0 rows.)
function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "Forbidden" as const, status: 403 };
  return { adminId: user.id };
}

function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

// Assign a custom domain to any vendor (admin only).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!vercelConfigured())
    return NextResponse.json({ error: "Domain hosting not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : null;
  const domain = normalizeDomain(body.domain);
  if (!vendorId || !domain)
    return NextResponse.json(
      { error: "vendorId and a valid domain are required." },
      { status: 400 }
    );

  const db = service();

  // If another vendor currently holds this domain, release it first — the admin
  // is explicitly moving the domain to this vendor (e.g. fixing a misassignment).
  const { data: existing } = await db
    .from("vendors")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", vendorId)
    .maybeSingle();
  if (existing) {
    await db
      .from("vendors")
      .update({ custom_domain: null, domain_verified: false, domain_added_at: null })
      .eq("id", existing.id);
  }

  // Release any old domain this vendor had, then attach the new one to Vercel.
  const { data: current } = await db
    .from("vendors")
    .select("custom_domain")
    .eq("id", vendorId)
    .single();
  if (current?.custom_domain && current.custom_domain !== domain) {
    await removeDomainFromProject(current.custom_domain).catch(() => {});
    const oldWww = wwwVariant(current.custom_domain);
    if (oldWww) await removeDomainFromProject(oldWww).catch(() => {});
  }

  try {
    await addDomainToProject(domain);
  } catch (e) {
    // Tolerate "already attached to this project"; otherwise surface the error.
    try {
      await getDomainStatus(domain);
    } catch {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not add domain" },
        { status: 400 }
      );
    }
  }

  // Also attach the www. form so www.<domain> works (best-effort).
  const www = wwwVariant(domain);
  if (www) await addDomainToProject(www).catch(() => {});

  const { error } = await db
    .from("vendors")
    .update({
      custom_domain: domain,
      domain_verified: false,
      domain_added_at: new Date().toISOString(),
    })
    .eq("id", vendorId);
  if (error) {
    await removeDomainFromProject(domain).catch(() => {});
    return NextResponse.json({ error: "Could not save domain." }, { status: 500 });
  }

  await db.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "assign_domain",
    target_type: "vendor",
    target_id: vendorId,
    detail: domain,
  });

  return NextResponse.json({ domain, verified: false, dns: dnsInstructionsFor(domain) });
}

// Remove a vendor's custom domain (admin only).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : null;
  if (!vendorId)
    return NextResponse.json({ error: "vendorId is required." }, { status: 400 });

  const db = service();
  const { data: v } = await db
    .from("vendors")
    .select("custom_domain")
    .eq("id", vendorId)
    .single();

  if (v?.custom_domain && vercelConfigured()) {
    await removeDomainFromProject(v.custom_domain).catch(() => {});
    const www = wwwVariant(v.custom_domain);
    if (www) await removeDomainFromProject(www).catch(() => {});
  }

  await db
    .from("vendors")
    .update({ custom_domain: null, domain_verified: false, domain_added_at: null })
    .eq("id", vendorId);

  await db.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "remove_domain",
    target_type: "vendor",
    target_id: vendorId,
    detail: v?.custom_domain ?? null,
  });

  return NextResponse.json({ ok: true });
}
