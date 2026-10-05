import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import DiscoverClient from "./DiscoverClient";

export const metadata: Metadata = { title: "Discover — Everything Local" };
export const revalidate = 300;

// The Discover hub: jump to Local Pages, Jobs, Events, Places to Explore, the
// blog, and learn how Everything Local works.
export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, category, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  return <DiscoverClient posts={posts ?? []} />;
}
