"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/types";
import { createClient } from "@/lib/supabase/client";

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
};

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [user, setUser] = useState<{ name: string | null; role: string | null } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [newVendors, setNewVendors] = useState<any[]>([]);
  const [localCity, setLocalCity] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Pre-fill location from saved neighborhood
    const saved = localStorage.getItem("hl_neighborhood");
    let savedCity: string | null = null;
    if (saved) {
      try {
        const { city, state } = JSON.parse(saved);
        if (city) { setLocation(state ? `${city}, ${state}` : city); savedCity = city; setLocalCity(city); }
      } catch {}
    }

    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, city, state")
          .eq("id", u.id)
          .single();
        setUser({ name: profile?.full_name ?? u.email ?? null, role: profile?.role ?? null });
        if (profile?.city && !savedCity) {
          localStorage.setItem("hl_neighborhood", JSON.stringify({ city: profile.city, state: profile.state ?? "" }));
          savedCity = profile.city;
          setLocalCity(profile.city);
          setLocation(profile.state ? `${profile.city}, ${profile.state}` : profile.city);
        }
      }
      setAuthChecked(true);

      // Fetch recent listings — join vendor to get slug, filter by city if known
      let listingsQuery = supabase
        .from("listings")
        .select("id, title, price, price_label, images, type, vendor:vendors!inner(business_name, slug, city)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (savedCity) listingsQuery = listingsQuery.ilike("vendors.city", `%${savedCity}%`);
      const { data: listings } = await listingsQuery;
      setRecentListings((listings ?? []).filter((l: any) => {
        const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
        return v?.slug;
      }));

      // Fetch new vendors
      let vendorsQuery = supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, category, city, rating")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (savedCity) vendorsQuery = vendorsQuery.ilike("city", `%${savedCity}%`);
      const { data: vendors } = await vendorsQuery;
      setNewVendors(vendors ?? []);
    });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    // Save whatever city they typed to localStorage
    if (location.trim()) {
      localStorage.setItem("hl_neighborhood", JSON.stringify({ city: location.trim(), state: "" }));
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("city", location.trim());
    router.push(`/search?${params.toString()}`);
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        router.push(`/search?lat=${latitude}&lng=${longitude}&q=${encodeURIComponent(query)}`);
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  function searchCategory(category: string) {
    const params = new URLSearchParams();
    params.set("category", category);
    const saved = localStorage.getItem("hl_neighborhood");
    if (saved) {
      try {
        const { city, state } = JSON.parse(saved);
        if (city) params.set("city", state ? `${city}, ${state}` : city);
      } catch {}
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600">HyperLocal</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">BETA</span>
          </Link>
          <div className="flex items-center gap-3">
            {!authChecked ? (
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
            ) : user ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:block">
                  Hi, <strong>{user.name?.split(" ")[0]}</strong>
                </span>
                <Link
                  href={user.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors"
                >
                  My dashboard →
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
        {/* Hero */}
        <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Find local businesses<br />
              <span className="text-green-600">in your neighborhood</span>
            </h1>
            <p className="text-lg text-gray-500 mb-10">
              Plumbers, restaurants, fresh produce, handmade goods — search your community.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "plumber", "italian food", "fresh eggs"...'
                className="flex-1 px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-100"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City or ZIP"
                  className="w-36 px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-100"
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  title="Use my location"
                  className="px-3 py-3 rounded-xl border border-gray-100 text-gray-400 hover:text-green-600 hover:border-green-300 transition-colors disabled:opacity-40"
                >
                  {locating
                    ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    : "📍"}
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Popular searches */}
            <div className="flex flex-wrap justify-center gap-2">
              {["Plumbers", "Italian food", "Fresh eggs", "Hair salons", "Dog grooming", "Handmade crafts"].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    if (location.trim()) localStorage.setItem("hl_neighborhood", JSON.stringify({ city: location.trim(), state: "" }));
                    router.push(`/search?q=${encodeURIComponent(term)}${location.trim() ? `&city=${encodeURIComponent(location.trim())}` : ""}`);
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
                  {localCity ? `Recent listings near ${localCity}` : "Recent listings"}
                </h2>
                <Link href={`/search${localCity ? `?city=${encodeURIComponent(localCity)}` : ""}`} className="text-sm text-green-600 hover:underline">View all →</Link>
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
                          : <span className="text-3xl text-gray-300">{l.type === "product" ? "📦" : "🔧"}</span>}
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
                  {localCity ? `New businesses in ${localCity}` : "New businesses"}
                </h2>
                <Link href={`/search${localCity ? `?city=${encodeURIComponent(localCity)}` : ""}`} className="text-sm text-green-600 hover:underline">View all →</Link>
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

        {/* Categories */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Browse by category</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => searchCategory(category)}
                  className="flex flex-col items-center p-4 rounded-2xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all group"
                >
                  <span className="text-2xl mb-1.5">{CATEGORY_ICONS[category] ?? "🏪"}</span>
                  <span className="text-xs font-medium text-gray-600 group-hover:text-green-700 text-center leading-tight">{category}</span>
                </button>
              ))}
            </div>
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
              List for free. Upgrade for $49/month to unlock analytics, bookings, and CRM tools. No transaction fees — you keep 100% of your sales.
            </p>
            <Link href="/signup?role=vendor" className="inline-block bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-400 transition-colors">
              List your business free →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8 px-4 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>© 2025 HyperLocal Marketplace. Support Local.</span>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-gray-900">About</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/contact" className="hover:text-gray-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
