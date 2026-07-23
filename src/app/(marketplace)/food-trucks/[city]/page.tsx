import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FoodTrucksBoardClient from "./FoodTrucksBoardClient";

function cityLabel(citySlug: string) {
  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { cityName, stateCode };
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const { cityName, stateCode } = cityLabel(city);
  const title = `Food Trucks in ${cityName}, ${stateCode} — Everything Local`;
  const description = `Find every food truck rolling around ${cityName}, ${stateCode} — menus, locations, and who's serving today.`;
  const og = `/api/og?title=${encodeURIComponent(`Food Trucks in ${cityName}`)}&subtitle=${encodeURIComponent("Find who's serving today")}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function FoodTrucksPage({ params }: { params: Promise<{ city: string }> }) {
  const supabase = await createClient();
  const { city: citySlug } = await params;
  const { cityName, stateCode } = cityLabel(citySlug);

  const { data: { user } } = await supabase.auth.getUser();

  // Food trucks are vendors, not places. Featured (paying) trucks sort first;
  // everyone else is listed free underneath.
  const { data: trucks } = await supabase
    .from("vendors")
    .select("id, business_name, slug, description, city, state, banner_url, logo_url, phone, website, latitude, longitude, food_truck_featured, food_truck, is_claimed, user_id, rating, review_count")
    .eq("category", "Food Trucks")
    .eq("is_active", true)
    .ilike("city", cityName)
    .eq("state", stateCode)
    .order("food_truck_featured", { ascending: false })
    .order("business_name");

  return (
    <FoodTrucksBoardClient
      citySlug={citySlug}
      cityName={cityName}
      stateCode={stateCode}
      trucks={(trucks ?? []) as any}
      currentUserId={user?.id ?? null}
    />
  );
}
