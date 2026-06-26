import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LocalProfileClient from "./LocalProfileClient";

// Focused Local Profile editor — just the profile, no dashboard tabs.
export default async function EditLocalProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding/buyer");

  const VENDOR_FIELDS = "id, business_name, slug, logo_url, category, city, state, tier, is_verified, rating";

  const { data: rawPicks } = await supabase
    .from("profile_business_picks")
    .select(`position, vendor:vendors(${VENDOR_FIELDS})`)
    .eq("user_id", user.id)
    .order("position");
  const businessPicks = (rawPicks ?? [])
    .map((row) => (Array.isArray(row.vendor) ? row.vendor[0] : row.vendor))
    .filter(Boolean);

  const { count: ownedBusinessCount } = await supabase
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <LocalProfileClient
      profile={profile}
      businessPicks={businessPicks as any}
      profileDetails={profile.profile_details ?? {}}
      ownedBusinessCount={ownedBusinessCount ?? 0}
    />
  );
}
