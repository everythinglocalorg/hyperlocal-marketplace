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

  // Check if this buyer also has a vendor account
  const { data: vendorAccount } = await supabase
    .from("vendors")
    .select("id, business_name, slug")
    .eq("user_id", user.id)
    .single();

  // ── Top 8 business picks ──
  // Pool of businesses the user has engaged with (messaged, reviewed, or booked).
  const VENDOR_FIELDS = "id, business_name, slug, logo_url, category, city, state, tier, is_verified, rating";

  const [{ data: convVendors }, { data: reviewVendors }, { data: bookingVendors }] = await Promise.all([
    supabase.from("conversations").select("vendor_id").eq("buyer_id", user.id),
    supabase.from("reviews").select("vendor_id").eq("reviewer_id", user.id),
    supabase.from("bookings").select("vendor_id").eq("customer_id", user.id),
  ]);

  const engagedIds = Array.from(
    new Set(
      [...(convVendors ?? []), ...(reviewVendors ?? []), ...(bookingVendors ?? [])]
        .map((r) => r.vendor_id as string | null)
        .filter((v): v is string => Boolean(v))
    )
  );

  const { data: engagedVendors } = engagedIds.length
    ? await supabase
        .from("vendors")
        .select(VENDOR_FIELDS)
        .in("id", engagedIds)
        .eq("is_active", true)
        .order("business_name")
    : { data: [] };

  const { data: rawPicks } = await supabase
    .from("profile_business_picks")
    .select(`position, vendor:vendors(${VENDOR_FIELDS})`)
    .eq("user_id", user.id)
    .order("position");

  const businessPicks = (rawPicks ?? [])
    .map((row) => (Array.isArray(row.vendor) ? row.vendor[0] : row.vendor))
    .filter(Boolean);

  // Fetch recent listings & new vendors in their saved city
  const savedCity = profile.city as string | null;
  const savedState = profile.state as string | null;

  const { data: recentListings } = await supabase
    .from("listings")
    .select("*, vendor:vendors(business_name, slug, logo_url, city, state)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6);

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
      vendorAccount={vendorAccount ?? null}
      engagedVendors={engagedVendors ?? []}
      businessPicks={businessPicks}
    />
  );
}
