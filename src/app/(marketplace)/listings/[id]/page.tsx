import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";

export default async function ListingRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, vendor:vendors(slug)")
    .eq("id", id)
    .single();

  if (!listing) notFound();

  const vendor = listing.vendor as { slug: string } | null;
  if (!vendor?.slug) notFound();

  redirect(`/vendors/${vendor.slug}`);
}
