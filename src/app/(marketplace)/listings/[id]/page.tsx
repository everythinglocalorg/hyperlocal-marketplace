import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductPageClient from "./ProductPageClient";

type Props = { params: Promise<{ id: string }> };

const LISTING_FIELDS =
  "id, title, description, type, price, price_label, condition, quantity, images, category, tags, cta_type, cta_url, sold_at, created_at, vendor:vendors(id, slug, business_name, city, state, address, logo_url, latitude, longitude, rating, review_count, is_business, phone, menu_pdf_url, payment_handles, category, pickup_info, food_truck, stripe_connect_enabled)";

async function loadListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(LISTING_FIELDS).eq("id", id).maybeSingle();
  if (!data) return null;
  const vendor = Array.isArray(data.vendor) ? data.vendor[0] : data.vendor;
  return { ...data, vendor };
}

// Link-preview metadata so sharing a product shows the photo.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing) return { title: "Listing — Everything Local" };
  const biz = listing.vendor?.business_name ?? "Everything Local";
  const title = `${listing.title} — ${biz}`;
  const description =
    listing.description ||
    `${listing.title} from ${biz}${listing.vendor?.city ? ` in ${listing.vendor.city}, ${listing.vendor.state}` : ""} on Everything Local.`;
  const image = listing.images?.[0] || listing.vendor?.logo_url || "/api/og";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: image ? [{ url: image, alt: listing.title }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const listing = await loadListing(id);
  if (!listing?.vendor) notFound();

  // Current user (for the buy / offer / message flows).
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle()
    : { data: null };

  // More local finds — other active listings from the same seller.
  const { data: more } = await supabase
    .from("listings")
    .select("id, title, price, price_label, images, type")
    .eq("vendor_id", listing.vendor.id)
    .eq("is_active", true)
    .neq("id", listing.id)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <ProductPageClient
      listing={listing}
      vendor={listing.vendor}
      currentUser={profile ?? null}
      more={more ?? []}
    />
  );
}
