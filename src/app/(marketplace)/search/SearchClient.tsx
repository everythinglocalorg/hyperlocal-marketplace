"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CITIES, CATEGORIES } from "@/types";
import VendorCard from "@/components/vendor/VendorCard";
import SearchBar from "@/components/search/SearchBar";
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

export default function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [citySlug, setCitySlug] = useState(searchParams.get("city") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [radius, setRadius] = useState(Number(searchParams.get("radius") ?? 25));
  const [sort, setSort] = useState(searchParams.get("sort") ?? "rating");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Support lat/lng from buyer onboarding location detection
  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramCity = searchParams.get("city_name") ?? searchParams.get("city") ?? "";
  const paramState = searchParams.get("state") ?? "";

  const selectedCity = CITIES.find((c) => c.slug === citySlug);

  // Resolved coordinates — either from a known city slug or from lat/lng params
  const resolvedCoords = selectedCity
    ? { latitude: selectedCity.latitude, longitude: selectedCity.longitude, label: `${selectedCity.name}, ${selectedCity.state}` }
    : (paramLat && paramLng)
    ? { latitude: Number(paramLat), longitude: Number(paramLng), label: [paramCity, paramState].filter(Boolean).join(", ") }
    : null;

  const updateURL = useCallback((params: Record<string, string>) => {
    const current = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) current.set(k, v);
      else current.delete(k);
    });
    router.push(`/search?${current.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const runSearch = useCallback(async () => {
    setLoading(true);

    try {
      if (query.trim()) {
        // Keyword search via RPC
        const { data } = await supabase.rpc("keyword_search", {
          p_query: query,
          p_city_slug: citySlug || null,
          p_type: "all",
          p_limit: 40,
          p_offset: 0,
        });
        setKeywordResults(data ?? []);
        setVendors([]);
        setTotalCount(data?.length ?? 0);
      } else if (resolvedCoords) {
        // Geo search by coordinates (works for any location)
        const { data } = await supabase.rpc("search_vendors_nearby", {
          p_latitude: resolvedCoords.latitude,
          p_longitude: resolvedCoords.longitude,
          p_radius_miles: radius,
          p_category: category || null,
          p_limit: 40,
          p_offset: 0,
        });

        let results: Vendor[] = data ?? [];

        // Client-side sort
        if (sort === "rating") results.sort((a, b) => b.rating - a.rating);
        else if (sort === "distance") results.sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));
        else if (sort === "local_bucks") results.sort((a, b) => b.local_bucks_earned - a.local_bucks_earned);

        setVendors(results);
        setKeywordResults([]);
        setTotalCount(results.length);
      } else {
        // No city selected — show all active vendors filtered by category
        let q = supabase
          .from("vendors")
          .select("*")
          .eq("is_active", true);

        if (category) q = q.eq("category", category);
        if (sort === "rating") q = q.order("rating", { ascending: false });
        else if (sort === "local_bucks") q = q.order("local_bucks_earned", { ascending: false });
        else q = q.order("created_at", { ascending: false });

        q = q.limit(40);

        const { data } = await q;
        setVendors(data ?? []);
        setKeywordResults([]);
        setTotalCount(data?.length ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, citySlug, category, radius, sort, selectedCity, supabase]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-green-600 shrink-0">
              HyperLocal
            </Link>
            <div className="flex-1">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  updateURL({ q: v });
                }}
                onSearch={runSearch}
                placeholder="Search vendors, products, services..."
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                showFilters || category || citySlug
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
              </svg>
              Filters
              {(category || citySlug) && (
                <span className="bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {[category, citySlug].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
              {/* City */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                <select
                  value={citySlug}
                  onChange={(e) => {
                    setCitySlug(e.target.value);
                    updateURL({ city: e.target.value });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All cities</option>
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}, {c.state}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    updateURL({ category: e.target.value });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Radius: <span className="text-green-600 font-semibold">{radius} miles</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={radius}
                  onChange={(e) => {
                    setRadius(Number(e.target.value));
                    updateURL({ radius: e.target.value });
                  }}
                  className="w-full accent-green-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1 mi</span>
                  <span>50 mi</span>
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    updateURL({ sort: e.target.value });
                  }}
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
              onClick={() => { setCategory(""); updateURL({ category: "" }); }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !category ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); updateURL({ category: c }); }}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Results header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? "Searching..." : (
              <>
                <span className="font-semibold text-gray-900">{totalCount}</span>{" "}
                {query ? `results for "${query}"` : "vendors found"}
                {resolvedCoords ? ` near ${resolvedCoords.label}` : ""}
              </>
            )}
          </p>
          {!showFilters && (
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
        ) : query && keywordResults.length > 0 ? (
          /* Keyword search results */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {keywordResults.map((r) => (
              <Link
                key={`${r.result_type}-${r.id}`}
                href={r.result_type === "vendor" ? `/vendors/${r.id}` : `/listings/${r.id}`}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="h-36 bg-gray-100 relative">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {r.result_type === "vendor" ? "🏪" : "📦"}
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600 capitalize">
                    {r.result_type}
                  </span>
                  {r.tier === "premium" && (
                    <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      PREMIUM
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
            ))}
          </div>
        ) : vendors.length > 0 ? (
          /* Geo / browse results */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vendors.map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-500 text-sm mb-6">
              {query
                ? `No vendors or listings matched "${query}". Try different keywords.`
                : "No vendors in this area yet. Be the first to list your business!"}
            </p>
            <Link
              href="/signup?role=vendor"
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              List Your Business Free
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
