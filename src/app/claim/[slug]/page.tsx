import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClaimClient from "./ClaimClient";

export default async function ClaimPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, city, state, category, phone, logo_url, is_claimed")
    .eq("slug", slug)
    .single();

  if (!vendor) redirect("/");
  if (vendor.is_claimed) redirect(`/vendors/${slug}`);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/claim/${slug}`);
  }

  return <ClaimClient vendor={vendor} slug={slug} />;
}
