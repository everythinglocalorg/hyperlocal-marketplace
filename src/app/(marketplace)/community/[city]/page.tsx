import { createClient } from "@/lib/supabase/server";
import CommunityBoardClient from "./CommunityBoardClient";

export default async function CommunityBoardPage({ params }: { params: Promise<{ city: string }> }) {
  const supabase = await createClient();
  const { city: citySlug } = await params;

  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = user
      ? await supabase.from("profiles").select("id, full_name, avatar_url, role").eq("id", user.id).single()
      : { data: null };

    // A business (vendor owner) may post paid Hiring / Offer posts.
    const { data: currentVendor } = user
      ? await supabase.from("vendors").select("id, business_name, slug").eq("user_id", user.id).limit(1).maybeSingle()
      : { data: null };

    const { data: posts, error: postsError } = await supabase
      .from("community_posts")
      .select("id, title, body, type, city, state, created_at, user_id, tagged_vendor_id, mentions")
      .eq("city_slug", citySlug)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (postsError) throw postsError;

    // Enrich posts with author and vendor info separately to avoid join issues
    const enrichedPosts: any[] = [];
    for (const post of posts ?? []) {
      const { data: author } = await supabase
        .from("profiles").select("id, full_name, avatar_url").eq("id", post.user_id).single();
      const { data: vendor } = post.tagged_vendor_id
        ? await supabase.from("vendors").select("id, business_name, slug, logo_url").eq("id", post.tagged_vendor_id).single()
        : { data: null };
      const { count: replyCount } = await supabase
        .from("community_responses").select("*", { count: "exact", head: true }).eq("post_id", post.id);

      enrichedPosts.push({
        ...post,
        author,
        tagged_vendor: vendor,
        response_count: [{ count: replyCount ?? 0 }],
        highfive_count: [{ count: 0 }],
      });
    }

    // High fives
    const myHighfives: string[] = [];
    try {
      if (user && enrichedPosts.length) {
        const { data: hf } = await supabase
          .from("community_post_highfives")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", enrichedPosts.map((p) => p.id));
        hf?.forEach((r: any) => myHighfives.push(r.post_id));

        const { data: hfAll } = await supabase
          .from("community_post_highfives")
          .select("post_id")
          .in("post_id", enrichedPosts.map((p) => p.id));
        if (hfAll) {
          const countMap: Record<string, number> = {};
          hfAll.forEach((r: any) => { countMap[r.post_id] = (countMap[r.post_id] ?? 0) + 1; });
          enrichedPosts.forEach((p) => { p.highfive_count = [{ count: countMap[p.id] ?? 0 }]; });
        }
      }
    } catch { /* highfives table not yet created */ }

    // Flags for admins
    let flaggedIds: { post_id: string | null; response_id: string | null }[] = [];
    try {
      if (profile?.role === "admin") {
        const { data: flags } = await supabase.from("community_flags").select("post_id, response_id").limit(500);
        flaggedIds = flags ?? [];
      }
    } catch { /* flags table not yet created */ }

    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, business_name, slug, logo_url, city, state")
      .eq("is_active", true)
      .order("business_name");

    return (
      <CommunityBoardClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        posts={enrichedPosts}
        vendors={vendors ?? []}
        currentUser={profile ?? null}
        currentVendor={currentVendor ?? null}
        myHighfives={myHighfives}
        flaggedIds={flaggedIds}
      />
    );
  } catch (err) {
    console.error("Community page error:", err);
    return (
      <CommunityBoardClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        posts={[]}
        vendors={[]}
        currentUser={null}
        currentVendor={null}
        myHighfives={[]}
        flaggedIds={[]}
      />
    );
  }
}
