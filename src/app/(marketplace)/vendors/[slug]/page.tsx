import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorProfileClient from "./VendorProfileClient";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}

// Link-preview (Open Graph / Twitter) metadata so shares in chats & messages
// show the business logo/banner instead of a blank default.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("business_name, description, category, city, state, logo_url, banner_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!vendor) return { title: "Business — Everything Local" };

  const title = `${vendor.business_name} — Everything Local`;
  const description =
    vendor.description ||
    `${vendor.business_name} · ${vendor.category} in ${vendor.city}, ${vendor.state}. Discover and support local on Everything Local.`;
  // Business logo/banner → branded card as last resort
  const image = vendor.logo_url || vendor.banner_url || "/api/og";

  return {
    title,
    description,
    // Canonical on the main domain — vendor pages also render on vanity custom
    // domains, so this consolidates ranking signals to everythinglocal.org.
    alternates: { canonical: `/vendors/${slug}` },
    openGraph: {
      title,
      description,
      type: "profile",
      images: image ? [{ url: image, alt: vendor.business_name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function VendorProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!vendor) notFound();

  // Track profile view
  await supabase
    .from("vendors")
    .update({ local_bucks_earned: vendor.local_bucks_earned })
    .eq("id", vendor.id);

  // Fetch listings
  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("vendor_id", vendor.id)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  // Vendor-defined product categories (sections) for the filter nav.
  const { data: listingCategories } = await supabase
    .from("listing_categories")
    .select("id, name, position")
    .eq("vendor_id", vendor.id)
    .order("position");

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, reviewer:profiles(full_name, avatar_url)")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Local Top 8 — auto-ranked "Best of {city}" award. A business earns the badge
  // if it ranks in the top 8 of its city by a popularity score. Only awarded when
  // the city has more than 8 active businesses, so "top 8" is genuinely a cut.
  // Ranks recompute automatically as engagement grows.
  let localTop8Rank: number | null = null;
  if (vendor.city && vendor.state) {
    const { data: cityVendors } = await supabase
      .from("vendors")
      .select("id, rating, review_count, local_bucks_earned, profile_views")
      .eq("is_active", true)
      .ilike("city", vendor.city)
      .eq("state", vendor.state);
    const list = cityVendors ?? [];
    if (list.length > 8) {
      const score = (v: typeof list[number]) =>
        (v.review_count ?? 0) * 100 +
        (v.profile_views ?? 0) * 10 +
        (v.local_bucks_earned ?? 0) * 3 +
        (v.rating ?? 0) * 2;
      const ranked = [...list].sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1));
      const idx = ranked.findIndex((v) => v.id === vendor.id);
      if (idx > -1 && idx < 8) localTop8Rank = idx + 1;
    }
  }

  // Founding Member — businesses that joined during the launch window wear a
  // Founding Member badge; later signups won't qualify, so it stays meaningful.
  const FOUNDING_MEMBER_CUTOFF = new Date("2027-01-01T00:00:00Z");
  const isFoundingMember = vendor.created_at
    ? new Date(vendor.created_at) < FOUNDING_MEMBER_CUTOFF
    : false;

  // Get current user if logged in
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("referral_code, local_bucks").eq("id", user.id).single()
    : { data: null };

  // LocalBusiness structured data (SEO) — areaServed comes from the vendor's
  // service locations so nearby searches can surface this business.
  const areaServed = [
    ...(Array.isArray(vendor.service_locations) ? vendor.service_locations : []),
    [vendor.city, vendor.state].filter(Boolean).join(", "),
  ].filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: vendor.business_name,
    description: vendor.description ?? undefined,
    telephone: vendor.phone ?? undefined,
    url: vendor.website ?? undefined,
    image: vendor.logo_url ?? vendor.banner_url ?? undefined,
    address: (vendor.address || vendor.city) ? {
      "@type": "PostalAddress",
      streetAddress: vendor.address ?? undefined,
      addressLocality: vendor.city ?? undefined,
      addressRegion: vendor.state ?? undefined,
      postalCode: vendor.zip_code ?? undefined,
    } : undefined,
    areaServed: areaServed.length > 0 ? areaServed.map((name) => ({ "@type": "Place", name })) : undefined,
    aggregateRating: vendor.review_count > 0 ? {
      "@type": "AggregateRating",
      ratingValue: vendor.rating,
      reviewCount: vendor.review_count,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <VendorProfileClient
        vendor={vendor}
        listings={listings ?? []}
        listingCategories={listingCategories ?? []}
        reviews={reviews ?? []}
        currentUserId={user?.id ?? null}
        currentUserReferralCode={profile?.referral_code ?? null}
        inboundRefCode={ref ?? null}
        localTop8Rank={localTop8Rank}
        isFoundingMember={isFoundingMember}
      />
    </>
  );
}
