import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import ExploreCityClient from "./ExploreCityClient";

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

    return (
      <ExploreCityClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        center={center}
        places={places}
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
        currentUserId={null}
      />
    );
  }
}
