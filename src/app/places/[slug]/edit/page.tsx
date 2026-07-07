import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditPlaceClient from "./EditPlaceClient";

interface Props { params: Promise<{ slug: string }> }

export default async function EditPlacePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/places/${slug}/edit`);

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!place) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;
  const isCreator = place.created_by === user.id || place.claimed_by === user.id;

  if (!isAdmin && !isCreator) redirect(`/places/${slug}`);

  // If user has a vendor account, load it so food trucks can link/unlink
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name")
    .eq("user_id", user.id)
    .single();

  return (
    <EditPlaceClient
      place={place}
      userId={user.id}
      isAdmin={isAdmin}
      vendorId={vendor?.id ?? null}
      vendorName={vendor?.business_name ?? null}
    />
  );
}
