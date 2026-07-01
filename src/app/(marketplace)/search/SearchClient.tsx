"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CITIES, CATEGORIES } from "@/types";
import { cityFromSlug, makeSlug, normalizeState, DEFAULT_CITY_SLUG, LS_CITY_KEY, type CityOption } from "@/lib/cities";
import VendorCard from "@/components/vendor/VendorCard";
import SearchBar from "@/components/search/SearchBar";
import CitySelector from "@/components/CitySelector";
import Link from "next/link";

type Vendor = {
  id: string;
  business_name: string;
  slug: string;
  description: string | null;
  category: string;
  city: string;
  state: string;
  logo_url: string | null;
  banner_url: string | null;
  tier: string;
  is_verified: boolean;
  rating: number;
  review_count: number;
  local_bucks_earned: number;
  distance_miles?: number;
};

type SearchResult = {
  result_type: string;
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  city: string;
  state: string;
  rating: number;
  tier: string;
  is_verified: boolean;
  rank: number;
};

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "distance", label: "Nearest" },
  { value: "newest", label: "Newest" },
  { value: "local_bucks", label: "Most Local Bucks" },
];

function ListingCard({ l }: { l: any }) {
  const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
  return (
    <Link
      href={vendor?.slug ? `/vendors/${vendor.slug}` : `/listings/${l.id}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="h-36 bg-gray-100 relative">
        {l.images?.[0] ? (
          <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {l.type === "rental" ? "🏠" : l.type === "thrift" ? "🏷️" : "📦"}
          </div>
        )}
        <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600 capitalize">{l.type}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm">{l.title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{l.category}</p>
        {vendor && (
          <p className="text-xs text-gray-500 mt-1">{vendor.business_name} · {vendor.city}, {vendor.state}</p>
        )}
        {l.price !== null && l.price !== undefined && (
          <p className="text-sm font-bold text-green-700 mt-2">${Number(l.price).toFixed(2)}</p>
        )}
        {l.price_label && !l.price && l.type !== "thrift" && (
          <p className="text-xs text-gray-500 mt-2">{l.price_label}</p>
        )}
        {l.type === "thrift" && l.price_label && (
          <p className="text-xs text-gray-500 mt-2">📍 {l.price_label}</p>
        )}
      </div>
    </Link>
  );
}

function KeywordListingCard({ r }: { r: SearchResult }) {
  return (
    <Link
      href={`/listings/${r.id}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="h-36 bg-gray-100 relative">
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
        )}
        <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600">listing</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{r.title}</h3>
        <p className="text-xs text-gray-500 mt-1">{r.subtitle}</p>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-gray-400">{r.city}, {r.state}</span>
        </div>
      </div>
    </Link>
  );
}

function KeywordVendorCard({ r }: { r: SearchResult }) {
  return (
    <Link
      href={r.slug ? `/vendors/${r.slug}` : "#"}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="h-36 bg-gray-100 relative">
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏪</div>
        )}
        <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600">business</span>
        {r.tier === "premium" && (
          <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            FEATURED
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{r.title}</h3>
          {r.is_verified && <span className="text-blue-500 shrink-0">✓</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1">{r.subtitle}</p>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-amber-400 text-xs">★</span>
          <span className="text-xs font-medium text-gray-700">{r.rating?.toFixed(1) ?? "New"}</span>
          <span className="text-xs text-gray-400 ml-1">{r.city}, {r.state}</span>
        </div>
      </div>
    </Link>
  );
}

export default function SearchClient({ initialCity }: { initialCity?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  // Eagerly resolve city on first render: URL param > profile (initialCity) > localStorage > default
  const [citySlug, setCitySlug] = useState<string>(() => {
    const urlCity = searchParams.get("city");
    if (urlCity) return urlCity;
    if (typeof window !== "undefined") {
      const fromStorage = localStorage.getItem(LS_CITY_KEY);
      if (fromStorage) return fromStorage;
    }
    return initialCity ?? DEFAULT_CITY_SLUG;
  });
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [radius, setRadius] = useState(Number(searchParams.get("radius") ?? 50));
  const [sort, setSort] = useState(searchParams.get("sort") ?? "rating");
  const [userId, setUserId] = useState<string | null>(null);

  // Products/listings section
  const [listingResults, setListingResults] = useState<any[]>([]);
  // Keyword search: split by result_type
  const [kwListings, setKwListings] = useState<SearchResult[]>([]);
  const [kwVendors, setKwVendors] = useState<SearchResult[]>([]);
  // Geo / browse: vendors section
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const listingMode = searchParams.get("mode") === "listings";
  const listingType = searchParams.get("type") ?? "";

  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramCity = searchParams.get("city_name") ?? searchParams.get("city") ?? "";
  const paramState = searchParams.get("state") ?? "";

  // activeCityObj as state so it resolves even for non-seed cities fetched dynamically
  const [activeCityObj, setActiveCityObj] = useState<CityOption | undefined>(() => cityFromSlug(citySlug));

  // If initial citySlug isn't in the seed list, resolve it from DB once
  useEffect(() => {
    if (activeCityObj) return;
    supabase
      .from("vendors")
      .select("city, state")
      .eq("is_active", true)
      .not("city", "is", null)
      .then(({ data }) => {
        for (const row of (data ?? [])) {
          if (makeSlug(row.city, row.state) === citySlug) {
            setActiveCityObj({ slug: citySlug, label: `${row.city}, ${row.state}`, city: row.city, state: row.state });
            return;
          }
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCity = useMemo(() => CITIES.find((c) => c.slug === citySlug), [citySlug]);

  const resolvedCoords = useMemo(() => {
    const coords = activeCityObj?.latitude != null
      ? { latitude: activeCityObj.latitude!, longitude: activeCityObj.longitude!, label: activeCityObj.label }
      : selectedCity
      ? { latitude: selectedCity.latitude, longitude: selectedCity.longitude, label: `${selectedCity.name}, ${selectedCity.state}` }
      : null;
    if (coords) return coords;
    if (paramLat && paramLng) {
      return { latitude: Number(paramLat), longitude: Number(paramLng), label: [paramCity, paramState].filter(Boolean).join(", ") };
    }
    return null;
  }, [activeCityObj, selectedCity, paramLat, paramLng, paramCity, paramState]);

  // On mount: get user id for profile saves
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateURL = useCallback((params: Record<string, string>) => {
    const current = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) current.set(k, v);
      else current.delete(k);
    });
    router.push(`/search?${current.toString()}`, { scroll: false });
  }, [searchParams, router]);

  function handleCityChange(slug: string, cityObj: CityOption) {
    setCitySlug(slug);
    setActiveCityObj(cityObj);
    updateURL({ city: slug });
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    if (userId) {
      supabase.from("profiles").update({ default_city: slug }).eq("id", userId);
    }
  }

  const runSearch = useCallback(async () => {
    setLoading(true);

    try {
      // Category pill / listing-type browse — show listings only (products first, no vendor section)
      if (listingMode) {
        let q = supabase
          .from("listings")
          .select("id, title, type, price, price_label, images, category, tags, vendor:vendors(id, slug, business_name, city, state, rating)")
          .eq("is_active", true);
        if (listingType) q = q.eq("type", listingType);
        else if (category) q = q.eq("category", category);
        q = q.order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(40);
        const { data } = await q;
        const cityFiltered = activeCityObj
          ? (data ?? []).filter((l: any) => {
              const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
              return v?.city?.toLowerCase() === activeCityObj.city.toLowerCase()
                && normalizeState(v?.state ?? "") === activeCityObj.state;
            })
          : (data ?? []);
        setListingResults(cityFiltered);
        setKwListings([]);
        setKwVendors([]);
        setVendors([]);
        return;
      }

      if (query.trim()) {
        // Keyword search — split into listings (top) and vendors (bottom, featured first)
        const { data } = await supabase.rpc("keyword_search", {
          p_query: query,
          p_city_slug: citySlug || null,
          p_type: "all",
          p_limit: 40,
          p_offset: 0,
        });
        const results: SearchResult[] = data ?? [];
        const listings = results.filter((r) => r.result_type === "listing");
        const vendorResults = results
          .filter((r) => r.result_type === "vendor")
          .sort((a, b) => (b.tier === "premium" ? 1 : 0) - (a.tier === "premium" ? 1 : 0));
        setKwListings(listings);
        setKwVendors(vendorResults);
        setListingResults([]);
        setVendors([]);
      } else if (resolvedCoords) {
        // Geo/nearby mode — listings section (newest) above vendors section (nearest)
        const [listingRes, vendorRes] = await Promise.all([
          supabase
            .from("listings")
            .select("id, title, type, price, price_label, images, category, tags, vendor:vendors(id, slug, business_name, city, state, rating)")
            .eq("is_active", true)
            .order("is_featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.rpc("search_vendors_nearby", {
            p_latitude: resolvedCoords.latitude,
            p_longitude: resolvedCoords.longitude,
            p_radius_miles: radius,
            p_category: category || null,
            p_limit: 40,
            p_offset: 0,
          }),
        ]);

        // Filter listings by city through joined vendor
        const filteredListings = activeCityObj
          ? (listingRes.data ?? []).filter((l: any) => {
              const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
              return v?.city?.toLowerCase() === activeCityObj.city.toLowerCase()
                && normalizeState(v?.state ?? "") === activeCityObj.state;
            })
          : (listingRes.data ?? []);

        let nearbyVendors: Vendor[] = (vendorRes.data ?? []).filter((v: Vendor) =>
          !activeCityObj || (
            v.city?.toLowerCase() === activeCityObj.city.toLowerCase()
            && normalizeState(v.state ?? "") === activeCityObj.state
          )
        );
        if (sort === "rating") nearbyVendors.sort((a, b) => b.rating - a.rating);
        else if (sort === "distance") nearbyVendors.sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));
        else if (sort === "local_bucks") nearbyVendors.sort((a, b) => b.local_bucks_earned - a.local_bucks_earned);

        setListingResults(filteredListings);
        setVendors(nearbyVendors);
        setKwListings([]);
        setKwVendors([]);
      } else {
        // No query, no geo — browse by active city
        let vendorQ = supabase
          .from("vendors")
          .select("*")
          .eq("is_active", true)
          .order("tier", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12);
        // Filter by city in DB; normalize state client-side to handle 'MINNESOTA' vs 'MN'
        if (activeCityObj) {
          vendorQ = vendorQ.ilike("city", activeCityObj.city);
        }

        const [listingRes, vendorRes] = await Promise.all([
          supabase
            .from("listings")
            .select("id, title, type, price, price_label, images, category, tags, vendor:vendors(id, slug, business_name, city, state, rating)")
            .eq("is_active", true)
            .order("is_featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(40),
          vendorQ,
        ]);

        const filteredListings = activeCityObj
          ? (listingRes.data ?? []).filter((l: any) => {
              const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
              return v?.city?.toLowerCase() === activeCityObj.city.toLowerCase()
                && normalizeState(v?.state ?? "") === activeCityObj.state;
            })
          : (listingRes.data ?? []);

        let browseVendors: Vendor[] = (vendorRes.data ?? []).filter((v: Vendor) =>
          !activeCityObj || normalizeState(v.state ?? "") === activeCityObj.state
        );
        if (category) browseVendors = browseVendors.filter((v) => v.category === category);
        setListingResults(filteredListings);
        setVendors(browseVendors);
        setKwListings([]);
        setKwVendors([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query, citySlug, category, radius, sort, selectedCity, supabase, listingMode, listingType, resolvedCoords, activeCityObj]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  // Derived counts for results header
  const isKeyword = !!query.trim() && !listingMode;
  const productCount = listingMode
    ? listingResults.length
    : isKeyword
    ? kwListings.length
    : listingResults.length;
  const bizCount = isKeyword ? kwVendors.length : vendors.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Row 1: logo / search bar / filters */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-green-600 shrink-0 hidden sm:block">
              Everything Local
            </Link>
            <Link href="/" aria-label="Home" className="sm:hidden shrink-0 p-2 -ml-1 text-green-600 hover:text-green-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
              </svg>
            </Link>
            <div className="flex-1">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  updateURL({ q: v });
                }}
                onSearch={runSearch}
                placeholder="Search products, services, businesses..."
              />
            </div>
            {/* City selector: hidden on mobile (shown in row 2), visible on sm+ */}
            <div className="hidden sm:block">
              <CitySelector
                value={citySlug}
                onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
                radius={radius}
                onRadiusChange={(r) => { setRadius(r); updateURL({ radius: String(r) }); }}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                showFilters || category
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
              </svg>
              <span className="hidden sm:inline">Filters</span>
              {category && (
                <span className="bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Row 2 (mobile only): city selector */}
          <div className="sm:hidden mt-2">
            <CitySelector
              value={citySlug}
              onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
              radius={radius}
              onRadiusChange={(r) => { setRadius(r); updateURL({ radius: String(r) }); }}
            />
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); updateURL({ category: e.target.value }); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); updateURL({ sort: e.target.value }); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            <button
              onClick={() => { setCategory(""); updateURL({ category: "", type: "", mode: "" }); }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !category && !listingMode ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); updateURL({ category: c, mode: "listings", type: "" }); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── PRODUCTS / LISTINGS SECTION ── */}
            {(listingMode ? listingResults : isKeyword ? kwListings : listingResults).length > 0 ? (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {listingMode
                        ? listingType
                          ? `${listingType.charAt(0).toUpperCase()}${listingType.slice(1)} Listings`
                          : category
                          ? `${category} Listings`
                          : "All Listings"
                        : isKeyword
                        ? `Products & Listings`
                        : "Latest Products"}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {productCount} {productCount === 1 ? "result" : "results"}
                      {activeCityObj && !isKeyword ? ` in ${activeCityObj.label}` : resolvedCoords && !listingMode && !activeCityObj ? ` near ${resolvedCoords.label}` : ""}
                    </p>
                  </div>
                  {!listingMode && !isKeyword && !showFilters && (
                    <select
                      value={sort}
                      onChange={(e) => { setSort(e.target.value); updateURL({ sort: e.target.value }); }}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {listingMode
                    ? listingResults.map((l: any) => <ListingCard key={l.id} l={l} />)
                    : isKeyword
                    ? kwListings.map((r) => <KeywordListingCard key={r.id} r={r} />)
                    : listingResults.map((l: any) => <ListingCard key={l.id} l={l} />)}
                </div>
              </section>
            ) : !listingMode ? null : (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No listings found</h3>
                <p className="text-gray-500 text-sm">No {listingType || category} listings yet in this area.</p>
              </div>
            )}

            {/* ── LOCAL BUSINESSES SECTION ── */}
            {!listingMode && (isKeyword ? kwVendors : vendors).length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Local Businesses</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {bizCount} {bizCount === 1 ? "business" : "businesses"}
                      {activeCityObj ? ` in ${activeCityObj.label}` : resolvedCoords ? ` near ${resolvedCoords.label}` : ""} · Featured first
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {isKeyword
                    ? kwVendors.map((r) => <KeywordVendorCard key={r.id} r={r} />)
                    : vendors.map((v) => <VendorCard key={v.id} vendor={v} />)}
                </div>
              </section>
            )}

            {/* ── EMPTY STATE ── */}
            {!loading && !listingMode && productCount === 0 && bizCount === 0 && (
              <div className="text-center py-24">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {query
                    ? `No products or businesses matched "${query}". Try different keywords.`
                    : "No listings in this area yet. Be the first to list your business!"}
                </p>
                <Link
                  href="/signup?role=vendor"
                  className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  List Your Business Free
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
