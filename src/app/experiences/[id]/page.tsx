import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExperienceDetail from "./ExperienceDetail";

type Props = { params: Promise<{ id: string }> };

async function loadExperience(id: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, price, images, vendor:vendors(id, business_name, slug, logo_url, city, state)")
    .eq("id", id)
    .eq("type", "experience")
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) return null;
  const [{ data: meta }, { data: rawStops }] = await Promise.all([
    supabase.from("experience_meta").select("theme, duration_label, best_for, est_cost_cents").eq("listing_id", id).maybeSingle(),
    supabase.from("experience_stops").select("*").eq("listing_id", id).order("day").order("position"),
  ]);
  const stops = rawStops ?? [];

  // Link stops back to the real business/place they reference.
  const vendorIds = stops.filter((s) => s.ref_type === "vendor" && s.ref_id).map((s) => s.ref_id);
  const placeIds = stops.filter((s) => s.ref_type === "place" && s.ref_id).map((s) => s.ref_id);
  const [vRes, pRes] = await Promise.all([
    vendorIds.length ? supabase.from("vendors").select("id, slug").in("id", vendorIds) : Promise.resolve({ data: [] as any[] }),
    placeIds.length ? supabase.from("places").select("id, slug").in("id", placeIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const hrefById = new Map<string, string>();
  (vRes.data ?? []).forEach((v: any) => v.slug && hrefById.set(v.id, `/vendors/${v.slug}`));
  (pRes.data ?? []).forEach((p: any) => p.slug && hrefById.set(p.id, `/places/${p.slug}`));

  return {
    listing,
    meta,
    stops: stops.map((s) => ({ ...s, href: s.ref_id ? hrefById.get(s.ref_id) ?? null : null })),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadExperience(id);
  if (!data) return { title: "Experience — Everything Local" };
  const v: any = Array.isArray(data.listing.vendor) ? data.listing.vendor[0] : data.listing.vendor;
  const title = `${data.listing.title} — Everything Local`;
  const description = data.listing.description ?? `A curated local itinerary by ${v?.business_name ?? "a Local Guide"}.`;
  const image = data.listing.images?.[0];
  return {
    title, description,
    openGraph: { title, description, type: "article", images: image ? [{ url: image, alt: data.listing.title }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function ExperiencePage({ params }: Props) {
  const { id } = await params;
  const data = await loadExperience(id);
  if (!data) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <ExperienceDetail
      listing={data.listing as any}
      meta={data.meta as any}
      stops={data.stops as any}
      currentUser={user ? { id: user.id, full_name: profile?.full_name ?? null, email: profile?.email ?? user.email ?? undefined } : null}
    />
  );
}
