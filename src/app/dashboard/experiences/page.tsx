import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPaidTier } from "@/lib/features";
import ExperiencesClient from "./ExperiencesClient";

// Local Guide builder — gated to businesses on a paid tier (see
// docs/local-experiences.md). Regular users become Guides by creating a
// business page first.
export default async function ExperiencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, business_name, tier, city, state, slug")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // No business yet → send them to create one (that's how you become a Guide).
  if (!vendors || vendors.length === 0) redirect("/onboarding/vendor");

  const paidVendorIds = vendors.filter((v) => isPaidTier(v.tier)).map((v) => v.id);

  return <ExperiencesClient vendors={vendors} paidVendorIds={paidVendorIds} />;
}
