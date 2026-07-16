import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorDashboardClient from "./VendorDashboardClient";
import { allFeaturesOn, isPaidTier, listingCap } from "@/lib/features";

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

  if (!vendor) {
    // Admins don't necessarily own a business of their own — send them to the
    // admin console instead of forcing them through vendor onboarding.
    const { data: adminCheck } = await supabase
      .from("profiles").select("is_admin").eq("id", user.id).single();
    redirect(adminCheck?.is_admin ? "/admin" : "/onboarding/vendor");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("local_bucks, full_name, referral_code, email, avatar_url, phone, is_admin, id")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  // Admins get all features for free
  const features = isAdmin ? allFeaturesOn() : (vendor.features ?? {});
  const isPremium = isAdmin || isPaidTier(vendor.tier);
  // Active-listing cap for the tier; null = unlimited (Infinity isn't JSON-serializable).
  const cap = isAdmin ? Infinity : listingCap(vendor.tier);
  const activeListingCap = Number.isFinite(cap) ? cap : null;

  return (
    <VendorDashboardClient
      vendor={vendor}
      profile={profile}
      isPremium={isPremium}
      features={features}
      activeListingCap={activeListingCap}
      isAdmin={isAdmin}
      connectEnabled={vendor.stripe_connect_enabled ?? false}
      connectAccountId={vendor.stripe_connect_account_id ?? null}
      initialTab={initialTab}
    />
  );
}
