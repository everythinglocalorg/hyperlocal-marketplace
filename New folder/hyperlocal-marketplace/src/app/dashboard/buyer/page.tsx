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

  return (
    <BuyerDashboardClient
      profile={profile}
      bookings={bookings ?? []}
      bucksHistory={bucksHistory ?? []}
      referrals={referrals ?? []}
      referredBy={referredBy}
    />
  );
}
