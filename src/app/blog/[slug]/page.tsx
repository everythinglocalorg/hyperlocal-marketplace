import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/markdown";

type Props = { params: Promise<{ slug: string }> };

const CAT_LABEL: Record<string, string> = { news: "News", tips: "Tips", highlight: "Business Highlight", guide: "Guide", other: "Post" };

async function loadPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Post — Everything Local" };
  const description = post.seo_description || post.excerpt || `${post.title} — from the Everything Local blog.`;
  const title = `${post.title} — Everything Local`;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title, description, type: "article",
      publishedTime: post.published_at ?? undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      images: post.cover_image_url ? [{ url: post.cover_image_url, alt: post.title }] : undefined,
    },
    twitter: {
      card: post.cover_image_url ? "summary_large_image" : "summary",
      title, description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  // Count the view (fire-and-forget)
  const supabase = await createClient();
  supabase.rpc("increment_blog_view", { p_slug: slug }).then(() => {}, () => {});

  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: { "@type": "Person", name: post.author_name || "Everything Local" },
    publisher: { "@type": "Organization", name: "Everything Local" },
    mainEntityOfPage: `/blog/${post.slug}`,
    keywords: Array.isArray(post.tags) ? post.tags.join(", ") : undefined,
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/blog" className="text-sm text-gray-500 hover:text-green-700">← Blog</Link>
        <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <span className="text-xs font-bold uppercase tracking-widest text-green-700">{CAT_LABEL[post.category] ?? "Post"}</span>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mt-2 mb-4">{post.title}</h1>

        {/* Author byline */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold overflow-hidden shrink-0">
            {post.author_avatar_url
              ? <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
              : (post.author_name?.[0] ?? "E")}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{post.author_name ?? "Everything Local"}</p>
            <p className="text-xs text-gray-400">{[post.author_title, dateStr].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="w-full rounded-2xl mb-8" />
        )}

        {/* Body */}
        <div className="text-[17px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body || "") }} />

        {/* Tags */}
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-gray-100">
            {post.tags.map((t: string) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">#{t}</span>
            ))}
          </div>
        )}

        {/* Highlighted business CTA */}
        {post.featured_vendor_slug && (
          <div className="mt-8 bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-600 mb-3">Featured in this post</p>
            <Link href={`/vendors/${post.featured_vendor_slug}`} className="inline-block bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              Visit the business →
            </Link>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 bg-gray-900 text-white rounded-2xl p-6 text-center">
          <h3 className="font-bold text-lg mb-1">Have a local business?</h3>
          <p className="text-gray-400 text-sm mb-4">Get discovered by neighbors on Everything Local — free during launch.</p>
          <Link href="/signup?role=vendor" className="inline-block bg-green-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-400 transition-colors">
            List your business free →
          </Link>
        </div>
      </article>
    </div>
  );
}
