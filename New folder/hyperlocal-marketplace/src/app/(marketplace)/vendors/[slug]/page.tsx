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

  return (
    <VendorProfileClient
      vendor={vendor}
      listings={listings ?? []}
      reviews={reviews ?? []}
      currentUserId={user?.id ?? null}
      currentUserReferralCode={profile?.referral_code ?? null}
      inboundRefCode={ref ?? null}
    />
  );
}
