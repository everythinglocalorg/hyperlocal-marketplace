import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Geocode the signed-in vendor's own street address to real coordinates via
// OpenStreetMap Nominatim (free, no key), and store lat/lng. A DB trigger keeps
// the PostGIS `location` in sync. Called fire-and-forget after a vendor saves
// their address (onboarding + Store Settings), so map pins stay accurate.

const UA = "EverythingLocalMarketplace/1.0 (dryarrington@gmail.com)";

async function geocode(v: { address: string; city?: string | null; state?: string | null; zip_code?: string | null }) {
  const p = new URLSearchParams({ street: v.address, city: v.city ?? "", state: v.state ?? "", country: "USA", format: "json", limit: "1" });
  if (v.zip_code) p.set("postalcode", v.zip_code);
  let r = await fetch("https://nominatim.openstreetmap.org/search?" + p.toString(), { headers: { "User-Agent": UA } });
  let j: any[] = await r.json().catch(() => []);
  if (!j?.[0]) {
    const p2 = new URLSearchParams({ q: `${v.address}, ${v.city ?? ""}, ${v.state ?? ""}, USA`, format: "json", limit: "1" });
    r = await fetch("https://nominatim.openstreetmap.org/search?" + p2.toString(), { headers: { "User-Agent": UA } });
    j = await r.json().catch(() => []);
  }
  return j?.[0] ? { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) } : null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: v } = await admin
    .from("vendors")
    .select("id, address, city, state, zip_code")
    .eq("user_id", user.id)
    .single();

  if (!v || !v.address || v.address.trim().length < 4) return NextResponse.json({ skipped: true });

  const g = await geocode(v as any);
  if (!g || !isFinite(g.lat) || !isFinite(g.lng)) return NextResponse.json({ skipped: true, reason: "not_found" });

  await admin.from("vendors").update({ latitude: g.lat, longitude: g.lng }).eq("id", v.id);
  return NextResponse.json({ ok: true, lat: g.lat, lng: g.lng });
}
