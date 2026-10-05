import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorDashboardClient from "./VendorDashboardClient";
import { allFeaturesOn, isPaidTier, listingCap } from "@/lib/features";

export default async function VendorDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; vendor?: string; new?: string }> }) {
  const { tab: initialTab, vendor: vendorParam, new: initialNew } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // A user can own more than one business — fetch them all (older `.single()`
  // errored when it found multiple, which forced onboarding). Pick the one from
  // ?vendor=<id>, otherwise the first.
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // When opening the Orders / Food Truck tabs without an explicit ?vendor=,
  // prefer the user's food-truck vendor so order notifications never land on a
  // non-truck vendor (which would show a blank Orders board).
  const wantsTruckTab = (initialNew ? "listings" : initialTab) === "orders" || (initialNew ? "listings" : initialTab) === "foodtruck";
  const truckVendor = wantsTruckTab
    ? vendors?.find((v) => v.category === "Food Trucks" || (v.food_truck && typeof v.food_truck === "object" && Object.keys(v.food_truck).length > 0))
    : undefined;

  const vendor =
    (vendorParam ? vendors?.find((v) => v.id === vendorParam) : undefined) ??
    truckVendor ??
    vendors?.[0] ??
    null;

  if (!vendor) redirect("/onboarding/vendor");

  // Options for the business switcher (only meaningful when the user owns >1).
  const vendorOptions = (vendors ?? []).map((v) => ({ id: v.id, business_name: v.business_name }));

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
      initialTab={initialNew ? "listings" : initialTab}
      initialNew={initialNew ?? null}
      vendorOptions={vendorOptions}
    />
  );
}
