import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Blog — Everything Local",
  description: "News, tips for selling online, and local business highlights from Everything Local.",
  openGraph: {
    title: "The Everything Local Blog",
    description: "News, marketplace tips, and local business highlights.",
    type: "website",
  },
};

export const revalidate = 300;

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "news", label: "News" },
  { key: "tips", label: "Tips" },
  { key: "highlight", label: "Business Highlights" },
  { key: "guide", label: "Guides" },
];
const CAT_LABEL: Record<string, string> = { news: "News", tips: "Tips", highlight: "Highlight", guide: "Guide", other: "Post" };

type Props = { searchParams: Promise<{ category?: string }> };

export default async function BlogIndexPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, category, author_name, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(60);
  if (category) q = q.eq("category", category);
  const { data: posts } = await q;

  const list = posts ?? [];
  const featured = !category && list.length > 0 ? list[0] : null;
  const rest = featured ? list.slice(1) : list;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-green-600">Everything Local</Link>
        <Link href="/search" className="text-sm text-gray-600 hover:text-green-700 font-medium">Explore local →</Link>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-2">The Everything Local Blog</p>
        <h1 className="text-4xl font-black text-gray-900 mb-3">Local news, tips &amp; business highlights</h1>
        <p className="text-gray-500 text-lg mb-8 max-w-2xl">Ideas to help local businesses grow, stories from your community, and guides for making the most of Everything Local.</p>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-10">
          {CATEGORIES.map((c) => (
            <Link key={c.key} href={c.key ? `/blog?category=${c.key}` : "/blog"}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                (category ?? "") === c.key ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {c.label}
            </Link>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="text-gray-400 py-20 text-center">No posts yet — check back soon.</p>
        ) : (
          <>
            {featured && (
              <Link href={`/blog/${featured.slug}`} className="block group mb-12">
                <div className="grid md:grid-cols-2 gap-6 items-center bg-gray-50 rounded-3xl overflow-hidden border border-gray-100">
                  <div className="h-56 md:h-72 bg-gray-200">
                    {featured.cover_image_url && <img src={featured.cover_image_url} alt={featured.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-6 md:p-8">
                    <span className="text-xs font-bold uppercase tracking-wide text-green-700">{CAT_LABEL[featured.category] ?? "Post"}</span>
                    <h2 className="text-2xl font-black text-gray-900 mt-2 mb-2 group-hover:text-green-700 transition-colors">{featured.title}</h2>
                    {featured.excerpt && <p className="text-gray-500 mb-4 line-clamp-3">{featured.excerpt}</p>}
                    <p className="text-xs text-gray-400">{featured.author_name ?? "Everything Local"}{featured.published_at ? ` · ${new Date(featured.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
                  </div>
                </div>
              </Link>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-green-200 transition-all">
                  <div className="h-40 bg-gray-100">
                    {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-bold uppercase tracking-wide text-green-700">{CAT_LABEL[p.category] ?? "Post"}</span>
                    <h3 className="font-bold text-gray-900 mt-1.5 mb-1 leading-snug group-hover:text-green-700 transition-colors line-clamp-2">{p.title}</h3>
                    {p.excerpt && <p className="text-sm text-gray-500 line-clamp-2">{p.excerpt}</p>}
                    <p className="text-xs text-gray-400 mt-3">{p.author_name ?? "Everything Local"}{p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
