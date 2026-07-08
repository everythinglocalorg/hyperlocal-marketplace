import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://every1local.com").replace(/\/$/, "");

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: posts }, { data: vendors }] = await Promise.all([
    supabase.from("blog_posts").select("slug, updated_at, published_at").eq("is_published", true),
    supabase.from("vendors").select("slug").eq("is_active", true).not("slug", "is", null).limit(10000),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    "", "/search", "/blog", "/pricing", "/incubator", "/about", "/contact",
  ].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6 }));

  const blog: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.updated_at || p.published_at || undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const businesses: MetadataRoute.Sitemap = (vendors ?? []).map((v) => ({
    url: `${BASE}/vendors/${v.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...blog, ...businesses];
}
