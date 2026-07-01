import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { geocodeCity } from "@/lib/geocode";

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Resolve a city's center coordinates for radius search.
// 1. Return cached coords from public.cities if present.
// 2. Otherwise geocode "City, State" once, cache it, and return.
// GET /api/cities/resolve?slug=northfield-mn&city=Northfield&state=MN
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim();
  const city = searchParams.get("city")?.trim();
  const state = searchParams.get("state")?.trim();

  if (!slug || !city || !state) {
    return NextResponse.json({ error: "slug, city, and state are required" }, { status: 400 });
  }

  const admin = getAdmin();

  // 1. Cache hit?
  const { data: cached } = await admin
    .from("cities")
    .select("slug, city, state, latitude, longitude")
    .eq("slug", slug)
    .maybeSingle();

  if (cached?.latitude != null && cached?.longitude != null) {
    return NextResponse.json({
      slug: cached.slug,
      city: cached.city,
      state: cached.state,
      latitude: cached.latitude,
      longitude: cached.longitude,
      cached: true,
    });
  }

  // 2. Geocode once (structured city match), then cache.
  const geo = await geocodeCity(city, state);
  if (!geo) {
    return NextResponse.json({ error: "Could not geocode city" }, { status: 404 });
  }

  await admin.from("cities").upsert(
    {
      slug,
      city,
      state,
      latitude: geo.latitude,
      longitude: geo.longitude,
    },
    { onConflict: "slug" }
  );

  return NextResponse.json({
    slug,
    city,
    state,
    latitude: geo.latitude,
    longitude: geo.longitude,
    cached: false,
  });
}
