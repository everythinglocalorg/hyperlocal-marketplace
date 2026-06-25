import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";

export default async function ListingRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get the listing's vendor_id
  const { data: listing } = await supabase
    .from("listings")
    .select("vendor_id")
    .eq("id", id)
    .single();

  if (!listing) notFound();

  // Get the vendor slug
  const { data: vendor } = await supabase
    .from("vendors")
    .select("slug")
    .eq("id", listing.vendor_id)
    .single();

  if (!vendor?.slug) notFound();

  redirect(`/vendors/${vendor.slug}`);
}
