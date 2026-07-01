"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { cityFromSlug, normalizeState, DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";
import CitySelector from "@/components/CitySelector";
import AtMentionDropdown from "@/components/AtMentionDropdown";
import { LocalProPriceInline } from "@/components/LocalProPrice";

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
  const [localCity, setLocalCity] = useState<string | null>(null);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);
  const [radius, setRadius] = useState(50);

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
        if (profile?.city) setLocalCity(profile.city);
        if (profile?.default_city) resolvedCitySlug = profile.default_city;
      }
      setAuthChecked(true);
      setActiveCity(resolvedCitySlug);

      const cityObj = cityFromSlug(resolvedCitySlug);

      // Fetch recent listings filtered by active city
      const { data: listings } = await supabase
        .from("listings")
        .select("id, title, price, price_label, images, type, vendor:vendors(business_name, slug, city, state)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      const filteredListings = cityObj
        ? (listings ?? []).filter((l: any) => {
            const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
            return v?.slug && v?.city?.toLowerCase() === cityObj.city.toLowerCase() && normalizeState(v?.state ?? "") === cityObj.state;
          })
        : (listings ?? []).filter((l: any) => {
            const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
            return v?.slug;
          });
      setRecentListings(filteredListings.slice(0, 8));

      // Fetch new vendors filtered by active city
      let vendorsQuery = supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, category, city, state, rating")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (cityObj) {
        vendorsQuery = vendorsQuery.ilike("city", cityObj.city);
      }
      const { data: vendors } = await vendorsQuery;
      setNewVendors(vendors ?? []);
    });
  }, []);

  function handleCityChange(slug: string, cityObj: any) {
    setActiveCity(slug);
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    if (user) {
      const supabase = createClient();
      supabase.from("profiles").update({ default_city: slug }).eq("id", user.id);
    }
    // Re-fetch listings and vendors for the new city
    const supabase = createClient();
    supabase
      .from("listings")
      .select("id, title, price, price_label, images, type, vendor:vendors(business_name, slug, city, state)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const filtered = cityObj
          ? (data ?? []).filter((l: any) => {
              const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
              return v?.slug && v?.city?.toLowerCase() === cityObj.city.toLowerCase() && normalizeState(v?.state ?? "") === cityObj.state;
            })
          : (data ?? []).filter((l: any) => {
              const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
              return v?.slug;
            });
        setRecentListings(filtered.slice(0, 8));
      });
    let vQ = supabase
      .from("vendors")
      .select("id, business_name, slug, logo_url, category, city, state, rating")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(6);
    if (cityObj) vQ = vQ.ilike("city", cityObj.city);
    vQ.then(({ data }) => setNewVendors(data ?? []));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeCity) params.set("city", activeCity);
    router.push(`/search?${params.toString()}`);
  }

  function searchCategory(category: string) {
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
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
            <span className="text-lg sm:text-2xl font-bold text-green-600 truncate">Everything Local</span>
            <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 rounded-full font-medium shrink-0">BETA</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!authChecked ? (
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
            ) : user ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:block">
                  Hello, <strong>{user.name?.split(" ")[0]}</strong>
                </span>
                <Link
                  href={user.role === "vendor" ? "/dashboard/vendor?tab=messages" : "/dashboard/buyer?tab=messages"}
                  title="Messages"
                  className="relative text-xl leading-none"
                >
                  💬
                </Link>
                <Link href="/notifications" title="Notifications" className="relative text-xl leading-none">
                  🔔
                  {notifUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                      {notifUnread > 9 ? "9+" : notifUnread}
                    </span>
                  )}
                </Link>
                {localCity && (
                  <Link
                    href={`/community/${localCity.toLowerCase().replace(/\s+/g, "-")}-mn`}
                    className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden sm:block"
                  >
                    🏘️ Ask Your Neighbors
                  </Link>
                )}
                <Link
                  href={user.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"}
                  className="text-sm bg-green-600 text-white px-3 sm:px-4 py-2 rounded-full hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">My Local Activity →</span>
                  <span className="sm:hidden">Activity →</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
                <Link href="/signup" className="text-sm bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors">
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Category bar */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap justify-center gap-1">
            {[
              ["Services & Trades","🔧"],
              ["Restaurants","🍽️"],
              ["Housing","🏠"],
              ["Products","📦"],
              ["Health & Beauty","💆"],
              ["Home & Garden","🏡"],
              ["Auto","🚗"],
              ["Events","🎉"],
              ["Clothing","👗"],
              ["Thrift Sales","🏷️"],
              ["Pets","🐾"],
              ["Sports","⚽"],
              ["Arts & Crafts","🎨"],
              ["Childcare","📚"],
            ].map(([label, icon]) => (
              <button key={label} onClick={() => searchCategory(label)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200 hover:border-green-300 transition-colors whitespace-nowrap">
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero */}
        <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Hidden Gems and Trusted Locals<br />
              <span className="text-green-600">In Your Neighborhood</span>
            </h1>
            <p className="text-lg text-gray-500 mb-10">
              Plumbers, restaurants, fresh produce, handmade goods — search your community.
            </p>

            {/* City selector */}
            <div className="flex justify-center mb-4">
              <CitySelector
                value={activeCity}
                onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
                radius={radius}
                onRadiusChange={setRadius}
              />
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 flex gap-2 mb-6">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "plumber", "fresh eggs"… or @ a person/business'
                  className="w-full px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-100"
                />
                <AtMentionDropdown query={query} />
              </div>
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Search
              </button>
            </form>

            {/* Popular searches */}
            <div className="flex flex-wrap justify-center gap-2">
              {["Plumbers", "Italian food", "Fresh eggs", "Hair salons", "Dog grooming", "Handmade crafts"].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(term)}${activeCity ? `&city=${activeCity}` : ""}`);
                  }}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-green-400 hover:text-green-700 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Recent listings */}
          {recentListings.length > 0 && (
            <div className="max-w-5xl mx-auto mt-14 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {activeCity ? `Recent Gems in ${cityFromSlug(activeCity)?.label ?? activeCity}` : "Recent Gems"}
                </h2>
                <Link href={`/search${activeCity ? `?city=${activeCity}` : ""}`} className="text-sm text-green-600 hover:underline">View all →</Link>
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
                  {activeCity ? `New businesses in ${cityFromSlug(activeCity)?.label ?? activeCity}` : "New businesses"}
                </h2>
                <Link href={`/search${activeCity ? `?city=${activeCity}` : ""}`} className="text-sm text-green-600 hover:underline">View all →</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {newVendors.map((v) => (
                  <Link key={v.id} href={`/vendors/${v.slug}`}
                    className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center text-center hover:shadow-md hover:border-green-200 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center font-bold text-green-700 overflow-hidden mb-2">
                      {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" /> : v.business_name[0]}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">{v.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate w-full">{v.category}</p>
                    {v.rating > 0 && <p className="text-xs text-amber-500 font-medium mt-1">★ {Number(v.rating).toFixed(1)}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>


        {/* Ask Your Neighbors */}
        <section className="py-14 px-4 bg-gray-50 border-t border-gray-100">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-3xl mb-3">🏘️</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Have a question?</h2>
            <p className="text-gray-500 text-base mb-6">
              {localCity
                ? `Post to the ${localCity} neighbor board — ask for help, find a product, or request a local service.`
                : "Find your local neighbor board — ask for help, find a product, or request a local service."}
            </p>
            <Link
              href={localCity
                ? `/community/${localCity.toLowerCase().replace(/\s+/g, "-")}-mn`
                : "/community/wells-township-mn"}
              className="inline-block bg-green-600 text-white font-bold px-8 py-3.5 rounded-full hover:bg-green-700 transition-colors"
            >
              Ask Your Neighbors →
            </Link>
            {!localCity && (
              <p className="text-xs text-gray-400 mt-3">Enter your city in the search bar above to see your local board</p>
            )}
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
                { icon: "🤝", label: "Refer a friend", bucks: "+50 LB" },
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
            <Link href="/signup?role=vendor" className="inline-block bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-400 transition-colors">
              List your business free →
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
              <li><Link href="/pricing" className="hover:text-green-600">Pricing</Link></li>
              <li><Link href="/local-bucks" className="hover:text-green-600">🪙 Local Bucks</Link></li>
              <li><Link href="/connect-domain" className="hover:text-green-600">Connect Your Domain</Link></li>
              <li><Link href="/dashboard/vendor" className="hover:text-green-600">Vendor Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">Community</p>
            <ul className="space-y-2">
              <li><Link href="/community/wells-township-mn" className="hover:text-green-600">Neighbor Board</Link></li>
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
    </div>
  );
}
