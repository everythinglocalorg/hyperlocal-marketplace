import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorDashboardClient from "./VendorDashboardClient";
import { allFeaturesOn } from "@/lib/features";

export default async function VendorDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: initialTab } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!vendor) redirect("/onboarding/vendor");

  const { data: profile } = await supabase
    .from("profiles")
    .select("local_bucks, full_name, referral_code, email, avatar_url, phone, is_admin, id")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  // Admins get all features for free
  const features = isAdmin ? allFeaturesOn() : (vendor.features ?? {});
  const isPremium = isAdmin || vendor.tier === "premium";

  return (
    <VendorDashboardClient
      vendor={vendor}
      profile={profile}
      isPremium={isPremium}
      features={features}
      isAdmin={isAdmin}
      connectEnabled={vendor.stripe_connect_enabled ?? false}
      connectAccountId={vendor.stripe_connect_account_id ?? null}
      initialTab={initialTab}
    />
  );
}
