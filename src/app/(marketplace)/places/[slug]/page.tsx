import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlaceProfileClient from "./PlaceProfileClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: place } = await supabase
    .from("places")
    .select("name, description, type, city, state, images")
    .eq("slug", slug)
    .maybeSingle();

  if (!place) return { title: "Place — Everything Local" };

  const title = `${place.name} — Everything Local`;
  const description =
    place.description ||
    `${place.name} · ${place.type.replace("_", " ")} in ${place.city}, ${place.state}. Discover local parks, trails & attractions on Everything Local.`;
  const image = place.images?.[0] ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image, alt: place.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PlaceProfilePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!place) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch creator profile
  const { data: creator } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", place.created_by)
    .maybeSingle();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: place.name,
    description: place.description ?? undefined,
    telephone: place.phone ?? undefined,
    url: place.website ?? undefined,
    image: place.images?.[0] ?? undefined,
    address: place.city ? {
      "@type": "PostalAddress",
      streetAddress: place.address ?? undefined,
      addressLocality: place.city,
      addressRegion: place.state,
      postalCode: place.zip ?? undefined,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PlaceProfileClient
        place={place}
        creator={creator ?? null}
        currentUserId={user?.id ?? null}
      />
    </>
  );
}
