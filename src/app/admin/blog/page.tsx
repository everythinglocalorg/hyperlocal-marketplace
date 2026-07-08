import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BlogAdminClient from "./BlogAdminClient";

export const metadata = { title: "Blog Admin — Everything Local" };

export default async function BlogAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("is_admin, full_name, avatar_url").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/");

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, slug, title, category, is_published, published_at, view_count, author_name")
    .order("created_at", { ascending: false });

  return (
    <BlogAdminClient
      posts={posts ?? []}
      defaultAuthorName={profile.full_name ?? "Everything Local Team"}
      defaultAuthorAvatar={profile.avatar_url ?? null}
    />
  );
}
