"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LS_CITY_KEY, DEFAULT_CITY_SLUG, resolveCity } from "@/lib/cities";
import { Newspaper, Briefcase, PartyPopper, Compass, ShoppingBag, Tag, Coins, HeartHandshake, Store, ArrowRight } from "lucide-react";

type Post = { slug: string; title: string; excerpt: string | null; cover_image_url: string | null; category: string | null; published_at: string | null };

// Discover = the "everything local" hub. Jumping-off point to Local Pages, Jobs,
// Events, Places to Explore, the blog, and how the platform works.
export default function DiscoverClient({ posts }: { posts: Post[] }) {
  const [city, setCity] = useState(DEFAULT_CITY_SLUG);
  useEffect(() => {
    try { const s = localStorage.getItem(LS_CITY_KEY); if (s) setCity(s); } catch { /* noop */ }
  }, []);
  const cityName = resolveCity(city)?.label?.split(",")[0] ?? "your town";

  const hubs = [
    { label: "Local Pages", desc: "Community board — ask, offer, and connect with neighbors.", href: `/community/${city}`, Icon: Newspaper, tint: "bg-green-50 text-green-700" },
    { label: "Local Jobs", desc: "Gigs and openings from businesses near you.", href: `/jobs/${city}`, Icon: Briefcase, tint: "bg-blue-50 text-blue-700" },
    { label: "Local Events", desc: "Markets, shows, and happenings around town.", href: `/search?mode=listings&type=event&city=${city}`, Icon: PartyPopper, tint: "bg-amber-50 text-amber-700" },
    { label: "Places to Explore", desc: "Parks, trails, and things to do nearby.", href: `/explore/${city}`, Icon: Compass, tint: "bg-emerald-50 text-emerald-700" },
  ];

  const more = [
    { label: "Shop Local", href: "/search?mode=listings", Icon: ShoppingBag },
    { label: "Sell an item", href: "/sell", Icon: Tag },
    { label: "Launch a business", href: "/onboarding/vendor", Icon: Store },
    { label: "Local Bucks", href: "/local-bucks", Icon: Coins },
    { label: "How it works", href: "/about", Icon: HeartHandshake },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Discover {cityName}</h1>
          <p className="text-gray-500 text-sm mt-1">Everything local, in one place — community, jobs, events, and things to do.</p>
        </header>

        {/* Main hubs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hubs.map(({ label, desc, href, Icon, tint }) => (
            <Link key={label} href={href} className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-green-300 hover:shadow-md transition-all flex items-start gap-4">
              <span className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${tint}`}><Icon className="w-6 h-6" strokeWidth={2} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-bold text-gray-900">{label} <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" /></span>
                <span className="block text-sm text-gray-500 mt-0.5">{desc}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Blog */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">From the blog</h2>
            <Link href="/blog" className="text-sm text-green-600 font-medium hover:underline">Visit the blog →</Link>
          </div>
          {posts.length === 0 ? (
            <Link href="/blog" className="block bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-500 hover:border-green-300 transition-colors">
              Tips, local business highlights, and marketplace news →
            </Link>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {posts.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-green-300 hover:shadow-md transition-all">
                  <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
                    {p.cover_image_url
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300"><Newspaper className="w-8 h-8" /></div>}
                  </div>
                  <div className="p-3">
                    {p.category && <span className="text-[11px] font-semibold text-green-600 uppercase tracking-wide">{p.category}</span>}
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 mt-0.5">{p.title}</p>
                    {p.excerpt && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* More */}
        <div className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-3">More on Everything Local</h2>
          <div className="flex flex-wrap gap-2">
            {more.map(({ label, href, Icon }) => (
              <Link key={label} href={href} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:border-green-300 hover:text-green-700 transition-colors">
                <Icon className="w-4 h-4" strokeWidth={2} /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
