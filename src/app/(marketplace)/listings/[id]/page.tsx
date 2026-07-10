import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RedirectClient from "./RedirectClient";

type Props = { params: Promise<{ id: string }> };

async function loadListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, title, description, images, price, vendor:vendors(slug, business_name, city, state, logo_url)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const vendor = Array.isArray(data.vendor) ? data.vendor[0] : data.vendor;
  return { ...data, vendor };
}

// Link-preview metadata so sharing a product in chats/messages shows the
// listing photo (falls back gracefully to a text card if it has no image).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing) return { title: "Listing — Everything Local" };

  const biz = listing.vendor?.business_name ?? "Everything Local";
  const title = `${listing.title} — ${biz}`;
  const description =
    listing.description ||
    `${listing.title} from ${biz}${listing.vendor?.city ? ` in ${listing.vendor.city}, ${listing.vendor.state}` : ""} on Everything Local.`;
  // Real photo → business logo → branded card as last resort
  const image = listing.images?.[0] || listing.vendor?.logo_url || "/api/og";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingRedirectPage({ params }: Props) {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing?.vendor?.slug) notFound();

  // Human visitors are forwarded to the vendor page; link-unfurl bots read the
  // Open Graph tags above (the listing photo) from this page's HTML first.
  return <RedirectClient to={`/vendors/${listing.vendor.slug}`} title={listing.title} />;
}
