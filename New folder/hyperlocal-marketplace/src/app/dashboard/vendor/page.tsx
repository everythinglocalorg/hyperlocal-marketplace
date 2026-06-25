import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VendorDashboardClient from "./VendorDashboardClient";

export default async function VendorDashboardPage() {
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
    .select("local_bucks, full_name, referral_code")
    .eq("id", user.id)
    .single();

  return (
    <VendorDashboardClient
      vendor={vendor}
      profile={profile}
      isPremium={vendor.tier === "premium"}
      connectEnabled={vendor.stripe_connect_enabled ?? false}
      connectAccountId={vendor.stripe_connect_account_id ?? null}
    />
  );
}
