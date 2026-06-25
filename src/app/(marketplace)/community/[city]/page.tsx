import { createClient } from "@/lib/supabase/server";
import CommunityBoardClient from "./CommunityBoardClient";

export default async function CommunityBoardPage({ params }: { params: { city: string } }) {
  const supabase = await createClient();
  const citySlug = params.city;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("id, full_name, avatar_url, role").eq("id", user.id).single()
    : { data: null };

  const { data: posts } = await supabase
    .from("community_posts")
    .select(`
      id, title, body, type, city, state, created_at,
      author:profiles!user_id(id, full_name, avatar_url),
      tagged_vendor:vendors(id, business_name, slug, logo_url),
      response_count:community_responses(count),
      highfive_count:community_post_highfives(count)
    `)
    .eq("city_slug", citySlug)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Which posts has the current user already high-fived?
  const myHighfives: string[] = [];
  if (user && posts?.length) {
    const { data: hf } = await supabase
      .from("community_post_highfives")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", posts.map((p: any) => p.id));
    hf?.forEach((r: any) => myHighfives.push(r.post_id));
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, business_name, slug, logo_url, city, state")
    .eq("is_active", true)
    .order("business_name");

  // Flagged post IDs visible to admins
  const { data: flaggedIds } = (profile?.role === "admin")
    ? await supabase.from("community_flags").select("post_id, response_id").limit(500)
    : { data: [] };

  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <CommunityBoardClient
      citySlug={citySlug}
      cityName={cityName}
      stateCode={stateCode}
      posts={posts ?? []}
      vendors={vendors ?? []}
      currentUser={profile ?? null}
      myHighfives={myHighfives}
      flaggedIds={flaggedIds ?? []}
    />
  );
}
