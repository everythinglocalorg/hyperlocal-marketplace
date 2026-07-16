import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import ExploreCityClient from "./ExploreCityClient";

// Miles between two lat/lng points. Places get their radius from the
// places_nearby RPC; Experiences are listings, so we scope them here instead of
// adding a second RPC.
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cityLabel(citySlug: string) {
  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { cityName, stateCode };
}

// Share preview: the Explore index has no single photo, so use a branded
// placeholder card (via /api/og). A specific place uses its own photo.
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const { cityName, stateCode } = cityLabel(city);
  const title = `Explore ${cityName}, ${stateCode} — Everything Local`;
  const description = `Discover local parks, trails, campgrounds, attractions, and hidden gems around ${cityName}, ${stateCode}.`;
  const og = `/api/og?title=${encodeURIComponent(`Explore ${cityName}`)}&subtitle=${encodeURIComponent("Local parks, trails & hidden gems")}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function ExploreCityPage({ params }: { params: Promise<{ city: string }> }) {
  const supabase = await createClient();
  const { city: citySlug } = await params;

  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts
    .slice(0, -1)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const seed = resolveCity(citySlug);
    let center: { latitude: number; longitude: number } | null =
      seed?.latitude != null && seed?.longitude != null
        ? { latitude: seed.latitude, longitude: seed.longitude }
        : null;

    if (!center) {
      const { data: cityRow } = await supabase
        .from("cities")
        .select("latitude, longitude")
        .eq("slug", citySlug)
        .maybeSingle();
      if (cityRow?.latitude != null && cityRow?.longitude != null) {
        center = { latitude: cityRow.latitude, longitude: cityRow.longitude };
      }
    }

    let places: any[] = [];
    if (center) {
      const { data, error } = await supabase.rpc("places_nearby", {
        p_latitude: center.latitude,
        p_longitude: center.longitude,
        p_radius_miles: 50,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      places = data ?? [];
    } else {
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("city_slug", citySlug)
        .order("created_at", { ascending: false });
      if (error) throw error;
      places = (data ?? []).map((p: any) => ({ ...p, distance_miles: 0 }));
    }

    // Published Experiences from Local Guides around this city.
    const { data: expRows } = await supabase
      .from("listings")
      .select(
        "id, title, description, images, vendor:vendors(business_name, slug, city, state, latitude, longitude), meta:experience_meta(duration_label, theme, best_for, is_published)"
      )
      .eq("type", "experience")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    const experiences = (expRows ?? [])
      .map((row: any) => {
        const v = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor;
        const m = Array.isArray(row.meta) ? row.meta[0] : row.meta;
        const distance =
          center && v?.latitude != null && v?.longitude != null
            ? milesBetween(center.latitude, center.longitude, v.latitude, v.longitude)
            : null;
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          images: row.images ?? [],
          guide_name: v?.business_name ?? "Local Guide",
          guide_slug: v?.slug ?? null,
          city: v?.city ?? null,
          state: v?.state ?? null,
          duration_label: m?.duration_label ?? null,
          theme: m?.theme ?? [],
          distance_miles: distance,
        };
      })
      .filter((e) =>
        center
          ? // Un-geocoded Guides fall back to a city/state match so they still surface.
            e.distance_miles != null
            ? e.distance_miles <= 50
            : e.city?.toLowerCase() === cityName.toLowerCase() && e.state === stateCode
          : e.city?.toLowerCase() === cityName.toLowerCase() && e.state === stateCode
      )
      .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));

    return (
      <ExploreCityClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        center={center}
        places={places}
        experiences={experiences}
        currentUserId={user?.id ?? null}
      />
    );
  } catch (err) {
    console.error("Explore city page error:", err);
    return (
      <ExploreCityClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        center={null}
        places={[]}
        experiences={[]}
        currentUserId={null}
      />
    );
  }
}
