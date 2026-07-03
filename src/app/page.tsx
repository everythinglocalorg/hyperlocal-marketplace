"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { resolveCity, normalizeState, fetchCityCenter, distanceMiles, DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";
import CitySelector from "@/components/CitySelector";
import AtMentionDropdown from "@/components/AtMentionDropdown";
import { LocalProPriceInline } from "@/components/LocalProPrice";
import VendorLogo from "@/components/vendor/VendorLogo";
import TypedText from "@/components/TypedText";
import WelcomeGateModal from "@/components/WelcomeGateModal";

const CATEGORY_ICONS: Record<string, string> = {
  "Products": "📦",
  "Services & Trades": "🔧",
  "Restaurants & Food": "🍽️",
  "Events & Rentals": "🎉",
  "Health & Beauty": "💆",
  "Home & Garden": "🏡",
  "Clothing & Accessories": "👗",
  "Arts & Crafts": "🎨",
  "Sports & Outdoors": "⚽",
  "Auto & Transportation": "🚗",
  "Pet Services": "🐾",
  "Childcare & Education": "📚",
  "Thrift Sales": "🏷️",
  "Rentals": "🏠",
  "Housing & Rentals": "🏠",
};

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<{ id: string; name: string | null; role: string | null } | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [newVendors, setNewVendors] = useState<any[]>([]);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);
  const [radius, setRadius] = useState(50);
  // Soft signup gate: guests see the welcome modal before searching/browsing.
  const [gateNext, setGateNext] = useState<string | null>(null);

  // Returns true (and opens the welcome modal) if the visitor is a guest.
  function gate(href: string): boolean {
    if (authChecked && !user) { setGateNext(href); return true; }
    return false;
  }

  useEffect(() => {
    const supabase = createClient();

    // Resolve active city: localStorage el_city > fallback
    const savedCitySlug = localStorage.getItem(LS_CITY_KEY);

    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      let resolvedCitySlug = savedCitySlug ?? DEFAULT_CITY_SLUG;

      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, city, state, default_city")
          .eq("id", u.id)
          .single();
        setUser({ id: u.id, name: profile?.full_name ?? u.email ?? null, role: profile?.role ?? null });
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("is_read", false)
          .then(({ count }) => setNotifUnread(count ?? 0));
        if (profile?.default_city) resolvedCitySlug = profile.default_city;
      }
      setAuthChecked(true);
      setActiveCity(resolvedCitySlug);
      loadCityData(resolvedCitySlug);
    });
  }, []);

  // Load recent listings + new vendors within `radius` miles of a city's center.
  // Vendors without coordinates fall back to an exact city/state match.
  async function loadCityData(slug: string) {
    const supabase = createClient();
    const cityObj = resolveCity(slug);
    const center = cityObj ? await fetchCityCenter(cityObj) : null;

    const inRange = (v: any) => {
      if (center && v?.latitude != null && v?.longitude != null) {
        return distanceMiles(center.latitude, center.longitude, v.latitude, v.longitude) <= radius;
      }
      if (cityObj) {
        return v?.city?.toLowerCase() === cityObj.city.toLowerCase() && normalizeState(v?.state ?? "") === cityObj.state;
      }
      return true;
    };

    // Recent listings — filter by the vendor's distance from the city center
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title, price, price_label, images, type, vendor:vendors(business_name, slug, city, state, latitude, longitude)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    const filteredListings = (listings ?? []).filter((l: any) => {
      const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
      return v?.slug && inRange(v);
    });
    setRecentListings(filteredListings.slice(0, 8));

    // New vendors — use the radius RPC when we have a center, else exact-city
    if (center) {
      const { data } = await supabase.rpc("search_vendors_nearby", {
        p_latitude: center.latitude,
        p_longitude: center.longitude,
        p_radius_miles: radius,
        p_limit: 6,
        p_offset: 0,
      });
      setNewVendors((data ?? []).filter((v: any) => v.slug));
    } else {
      let vQ = supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, category, city, state, rating")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (cityObj) vQ = vQ.ilike("city", cityObj.city);
      const { data } = await vQ;
      setNewVendors(data ?? []);
    }
  }

  function handleCityChange(slug: string, _cityObj: any) {
    setActiveCity(slug);
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    if (user) {
      const supabase = createClient();
      supabase.from("profiles").update({ default_city: slug }).eq("id", user.id);
    }
    loadCityData(slug);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeCity) params.set("city", activeCity);
    const url = `/search?${params.toString()}`;
    if (gate(url)) return;
    router.push(url);
  }

  function searchCategory(category: string) {
    track("category_pill_click", { category, source: "homepage" });
    const LABEL_MAP: Record<string, string> = {
      "Restaurants": "Restaurants & Food",
      "Events": "Events & Rentals",
      "Clothing": "Clothing & Accessories",
      "Auto": "Auto & Transportation",
      "Sports": "Sports & Outdoors",
      "Pets": "Pet Services",
      "Childcare": "Childcare & Education",
      "Housing": "Housing & Rentals",
    };
    // Rentals and Thrift Sales are listing types, not vendor categories — search by type
    const TYPE_MAP: Record<string, string> = {
      "Rentals": "rental",
      "Thrift Sales": "thrift",
    };
    const params = new URLSearchParams();
    if (activeCity) params.set("city", activeCity);
    if (TYPE_MAP[category]) {
      params.set("type", TYPE_MAP[category]);
      params.set("mode", "listings");
    } else {
      params.set("category", LABEL_MAP[category] ?? category);
      params.set("mode", "listings");
    }
    const url = `/search?${params.toString()}`;
    if (gate(url)) return;
    router.push(url);
  }

  const cityName = resolveCity(activeCity)?.label?.split(",")[0] ?? "your town";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <main className="flex-1">
        {/* Category bar — single horizontal-scroll row on mobile (top picks lead,
            swipe for the rest); wraps and centers on sm+ to show everything. */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-1 overflow-x-auto flex-nowrap scrollbar-hide sm:flex-wrap sm:justify-center sm:overflow-visible">
            {[
              ["Services & Trades","🔧"],
              ["Restaurants","🍽️"],
              ["Housing","🏠"],
              ["Thrift Sales","🏷️"],
              ["Products","📦"],
              ["Health & Beauty","💆"],
              ["Home & Garden","🏡"],
              ["Auto","🚗"],
              ["Events","🎉"],
              ["Clothing","👗"],
              ["Pets","🐾"],
              ["Sports","⚽"],
              ["Arts & Crafts","🎨"],
              ["Childcare","📚"],
            ].map(([label, icon]) => (
              <button key={label} onClick={() => searchCategory(label)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200 hover:border-green-300 transition-colors whitespace-nowrap">
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-14 sm:pt-20 pb-16 px-4">
          {/* soft glow accents */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-green-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="relative max-w-3xl mx-auto text-center">
            {/* trust chip */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-green-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
              <span className="flex -space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-green-500 border-2 border-white" />
                <span className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-white" />
                <span className="w-5 h-5 rounded-full bg-amber-400 border-2 border-white" />
              </span>
              <span className="text-xs font-semibold text-gray-600">Over 150 locals already on Everything Local</span>
            </div>

            <h1 className="text-3xl sm:text-[2.7rem] font-black text-gray-900 mb-4 leading-[1.1] tracking-tight">
              Discover the best of <TypedText text={cityName} />.<br />
              <span className="text-green-600">Get rewarded for shopping local.</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
              One search for every local business, product, and service near you —
              and every dollar you spend earns <span className="font-semibold text-amber-600">🪙 Local Bucks</span> to spend around town.
            </p>

            {/* City selector */}
            <div className="flex justify-center mb-3">
              <CitySelector
                value={activeCity}
                onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
                radius={radius}
                onRadiusChange={setRadius}
              />
            </div>

            {/* Search bar — the obvious primary action */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 border border-gray-100 p-3 flex gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "plumber", "fresh eggs"… or @ a person/business'
                  className="w-full px-4 py-3.5 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-100"
                />
                <AtMentionDropdown query={query} />
              </div>
              <button
                type="submit"
                className="bg-green-600 text-white px-7 py-3.5 rounded-xl text-base font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 whitespace-nowrap"
              >
                Search →
              </button>
            </form>

            {/* Friction-killer trust line */}
            <p className="text-xs text-gray-400 mb-5">100% free · No credit card needed · Now Live in Your Neighborhood</p>

            {/* Value chips — reasons to keep reading */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-500 mb-6">
              <span className="inline-flex items-center gap-1.5">⚡ Instant local search</span>
              <span className="inline-flex items-center gap-1.5">🪙 Earn Local Bucks</span>
              <span className="inline-flex items-center gap-1.5">💬 Message businesses direct</span>
              <span className="inline-flex items-center gap-1.5">✅ 100% locally owned</span>
            </div>

            {/* Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/search${activeCity ? `?city=${activeCity}` : ""}`}
                onClick={(e) => { if (gate(`/search${activeCity ? `?city=${activeCity}` : ""}`)) e.preventDefault(); }}
                className="w-full sm:w-auto bg-gray-900 text-white font-bold px-6 py-3 rounded-2xl hover:bg-gray-800 transition-colors text-center"
              >
                Browse all local businesses →
              </Link>
              <Link
                href="/signup?role=vendor"
                className="w-full sm:w-auto border-2 border-green-600 text-green-700 font-bold px-6 py-3 rounded-2xl hover:bg-green-50 transition-colors text-center"
              >
                List your business — free
              </Link>
            </div>
          </div>

          {/* Recent listings */}
          {recentListings.length > 0 && (
            <div className="max-w-5xl mx-auto mt-14 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {activeCity ? `Recent Gems in ${resolveCity(activeCity)?.label ?? activeCity}` : "Recent Gems"}
                </h2>
                <Link href={`/search${activeCity ? `?city=${activeCity}` : ""}`} onClick={(e) => { if (gate(`/search${activeCity ? `?city=${activeCity}` : ""}`)) e.preventDefault(); }} className="text-sm text-green-600 hover:underline">View all →</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {recentListings.map((l) => {
                  const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
                  const slug = vendor?.slug;
                  if (!slug) return null;
                  return (
                    <Link key={l.id} href={`/vendors/${slug}`}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-green-200 transition-all">
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                        {l.images?.[0]
                          ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                          : <span className="text-3xl text-gray-300">{{ product:"📦", service:"🔧", restaurant:"🍽️", event:"🎉", rental:"🏠", thrift:"🏷️" }[l.type as string] ?? "📦"}</span>}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-gray-900 line-clamp-1">{l.title}</p>
                        <p className="text-xs text-gray-400 truncate">{vendor?.business_name}</p>
                        {l.price != null
                          ? <p className="text-xs font-bold text-green-700 mt-1">${Number(l.price).toFixed(2)}</p>
                          : l.price_label && <p className="text-xs text-gray-500 mt-1">{l.price_label}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* New businesses */}
          {newVendors.length > 0 && (
            <div className="max-w-5xl mx-auto mt-10 px-4 pb-14">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {activeCity ? `New businesses in ${resolveCity(activeCity)?.label ?? activeCity}` : "New businesses"}
                </h2>
                <Link href={`/search${activeCity ? `?city=${activeCity}` : ""}`} onClick={(e) => { if (gate(`/search${activeCity ? `?city=${activeCity}` : ""}`)) e.preventDefault(); }} className="text-sm text-green-600 hover:underline">View all →</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {newVendors.map((v) => (
                  <Link key={v.id} href={`/vendors/${v.slug}`}
                    className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center text-center hover:shadow-md hover:border-green-200 transition-all">
                    <VendorLogo src={v.logo_url} name={v.business_name} className="w-12 h-12 mb-2" fallbackTextClass="text-base" />
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">{v.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate w-full">{v.category}</p>
                    {v.rating > 0 && <p className="text-xs text-amber-500 font-medium mt-1">★ {Number(v.rating).toFixed(1)}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Why Everything Local */}
        <section className="py-16 px-4 bg-white border-t border-gray-100">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">We&apos;re not another Amazon or Yelp</h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-10">
              We&apos;re building something that puts your community first — one place for everything and everyone local.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
              {[
                { icon: "🏘️", title: "Truly Local", body: "Every business, listing, and service lives right here in your area." },
                { icon: "🎯", title: "One Destination", body: "Products, services, food, events, rentals, makers — one go-to hub." },
                { icon: "✅", title: "Community Verified", body: "Know exactly who you're buying from, with reviews you can trust." },
                { icon: "💎", title: "Discover Hidden Gems", body: "Find the local businesses and creators you didn't know existed." },
              ].map((c) => (
                <div key={c.title} className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{c.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-gray-50 border-t border-gray-100">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-10">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { n: "1", icon: "🔎", title: "Search local", body: "Find businesses, products, and services near you — filtered to your town." },
                { n: "2", icon: "💬", title: "Connect direct", body: "Message, book, request an estimate, or buy — straight from the business." },
                { n: "3", icon: "🪙", title: "Earn Local Bucks", body: "Get rewarded for shopping and referring — then spend it around town." },
              ].map((s) => (
                <div key={s.n} className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-green-600 text-white text-2xl font-black flex items-center justify-center mx-auto mb-4">{s.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{s.n}. {s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Ask Your Neighbors */}
        <section className="py-14 px-4 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-3xl mb-3">🏘️</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Have a question?</h2>
            <p className="text-gray-500 text-base mb-6">
              Post to the {resolveCity(activeCity)?.label ?? activeCity} neighbor board — ask for help, find a product, or request a local service.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/community/${activeCity}`}
                className="inline-block bg-green-600 text-white font-bold px-8 py-3.5 rounded-full hover:bg-green-700 transition-colors"
              >
                Ask Your Neighbors →
              </Link>
              <Link
                href={`/jobs/${activeCity}`}
                className="inline-block bg-white border border-green-300 text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors"
              >
                💼 Browse Local Jobs
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-3">Switch towns with the city selector above to browse other boards</p>
          </div>
        </section>

        {/* Sign up prompt */}
        <section className="py-14 px-4 bg-green-600">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-green-200 mb-3">Free to join</p>
            <h2 className="text-3xl font-bold mb-3">Earn rewards for shopping local</h2>
            <p className="text-green-100 text-lg mb-8">
              Sign up free and earn <strong>10 Local Bucks</strong> instantly. Your local area is saved to your account — we show you new businesses and listings near you every time you log in.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-white text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors">
                Create free account →
              </Link>
              <Link href="/signup?role=vendor" className="border-2 border-white text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors">
                List your business
              </Link>
            </div>
            <div className="flex justify-center gap-8 mt-10 text-sm text-green-100">
              {[
                { icon: "👋", label: "Sign up", bucks: "+10 LB" },
                { icon: "⭐", label: "Leave a review", bucks: "+5 LB" },
                { icon: "🤝", label: "Refer a friend", bucks: "+20 LB" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xl mb-1">{item.icon}</p>
                  <p className="font-semibold text-white">{item.bucks}</p>
                  <p className="text-green-200 text-xs">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vendor CTA */}
        <section className="py-14 px-4 bg-gray-900 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3">Have a local business?</h2>
            <p className="text-gray-400 mb-8">
              List for free. Upgrade for <LocalProPriceInline inverted /> to unlock analytics, bookings, and CRM tools. No transaction fees — you keep 100% of your sales.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup?role=vendor" className="inline-block bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-400 transition-colors">
                List your business free →
              </Link>
              <Link href="/incubator" className="inline-block border-2 border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition-colors">
                🚀 Start a business
              </Link>
            </div>
          </div>
        </section>

        {/* Business Incubator teaser */}
        <section className="py-16 px-4 bg-green-50 border-t border-green-100">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">Business Incubator</p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Dreaming of starting your own local business?</h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-8">
              Everything Local helps you go from idea to open — free guides, tools, and a built-in local audience ready to support you from day one.
            </p>
            <Link href="/incubator" className="inline-block bg-green-600 text-white font-bold px-8 py-3.5 rounded-full hover:bg-green-700 transition-colors">
              Explore the Incubator →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-12 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm text-gray-500 mb-10">
          <div>
            <p className="font-bold text-gray-900 mb-3">Explore</p>
            <ul className="space-y-2">
              <li><Link href="/search" className="hover:text-green-600">Browse All</Link></li>
              <li><Link href="/search?mode=listings&type=rental" className="hover:text-green-600">Rentals</Link></li>
              <li><Link href="/search?mode=listings&type=thrift" className="hover:text-green-600">Thrift Sales</Link></li>
              <li><Link href="/search?mode=listings&category=Restaurants+%26+Food" className="hover:text-green-600">Restaurants</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">For Businesses</p>
            <ul className="space-y-2">
              <li><Link href="/signup?role=vendor" className="hover:text-green-600">Get Started</Link></li>
              <li><Link href="/incubator" className="hover:text-green-600">🚀 Business Incubator</Link></li>
              <li><Link href="/pricing" className="hover:text-green-600">Pricing</Link></li>
              <li><Link href="/local-bucks" className="hover:text-green-600">🪙 Local Bucks</Link></li>
              <li><Link href="/connect-domain" className="hover:text-green-600">Connect Your Domain</Link></li>
              <li><Link href="/dashboard/vendor" className="hover:text-green-600">Vendor Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">Community</p>
            <ul className="space-y-2">
              <li><Link href={`/community/${activeCity}`} className="hover:text-green-600">Neighbor Board</Link></li>
              <li><Link href={`/jobs/${activeCity}`} className="hover:text-green-600">Jobs Board</Link></li>
              <li><Link href="/signup" className="hover:text-green-600">Join Free</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">Company</p>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-green-600">About</Link></li>
              <li><Link href="/contact" className="hover:text-green-600">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-green-600">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-green-600">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span className="font-semibold text-green-600 text-sm">Everything Local</span>
          <span>© 2026 Everything Local · Made for local communities</span>
        </div>
      </footer>

      {/* Soft signup gate for guests (search / browse) */}
      <WelcomeGateModal open={!!gateNext} next={gateNext ?? undefined} onClose={() => setGateNext(null)} />

      {/* Spacer so the sticky bar never covers footer content on mobile */}
      <div className="h-20 lg:hidden" />

      {/* Sticky conversion bar (mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 flex gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <Link
          href={`/search${activeCity ? `?city=${activeCity}` : ""}`}
          onClick={(e) => { if (gate(`/search${activeCity ? `?city=${activeCity}` : ""}`)) e.preventDefault(); }}
          className="flex-1 bg-green-600 text-white text-center text-sm font-bold py-3 rounded-xl hover:bg-green-700 transition-colors"
        >
          🔎 Explore local
        </Link>
        <Link
          href="/signup?role=vendor"
          className="flex-1 border-2 border-green-600 text-green-700 text-center text-sm font-bold py-3 rounded-xl hover:bg-green-50 transition-colors"
        >
          List your business
        </Link>
      </div>
    </div>
  );
}
