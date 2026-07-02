import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorProfileClient from "./VendorProfileClient";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
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

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, reviewer:profiles(full_name, avatar_url)")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(10);

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
        reviews={reviews ?? []}
        currentUserId={user?.id ?? null}
        currentUserReferralCode={profile?.referral_code ?? null}
        inboundRefCode={ref ?? null}
      />
    </>
  );
}
