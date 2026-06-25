import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuyerDashboardClient from "./BuyerDashboardClient";

export default async function BuyerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding/buyer");

  // Fetch bookings with vendor info
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, vendor:vendors(business_name, slug, logo_url, city, state)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch Local Bucks transaction history
  const { data: bucksHistory } = await supabase
    .from("local_bucks_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch referrals (people I referred)
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*, referred:profiles!referred_id(full_name, email)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch who referred me
  const referredById = profile.referred_by;
  const { data: referredBy } = referredById
    ? await supabase
        .from("profiles")
        .select("full_name, email, referral_code")
        .eq("id", referredById)
        .single()
    : { data: null };

  // Fetch recent listings & new vendors in their saved city
  const savedCity = profile.city as string | null;
  const savedState = profile.state as string | null;

  const { data: recentListings } = savedCity
    ? await supabase
        .from("listings")
        .select("*, vendor:vendors!inner(business_name, slug, logo_url, city, state)")
        .eq("is_active", true)
        .ilike("vendors.city", `%${savedCity}%`)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  const { data: newVendors } = savedCity
    ? await supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, banner_url, category, city, state, rating, review_count, tier, is_verified")
        .eq("is_active", true)
        .ilike("city", `%${savedCity}%`)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  return (
    <BuyerDashboardClient
      profile={profile}
      bookings={bookings ?? []}
      bucksHistory={bucksHistory ?? []}
      referrals={referrals ?? []}
      referredBy={referredBy}
      recentListings={recentListings ?? []}
      newVendors={newVendors ?? []}
      savedCity={savedCity}
      savedState={savedState}
    />
  );
}
