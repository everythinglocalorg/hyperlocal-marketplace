"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { track, trackSearch } from "@/lib/analytics";
import { isPaidTier } from "@/lib/features";
import { CITIES, CATEGORIES } from "@/types";
import { cityFromSlug, resolveCity, makeSlug, normalizeState, fetchCityCenter, distanceMiles, DEFAULT_CITY_SLUG, LS_CITY_KEY, type CityOption, type CityCenter } from "@/lib/cities";
import VendorCard from "@/components/vendor/VendorCard";
import SearchBar from "@/components/search/SearchBar";
import SearchSuggestions from "@/components/SearchSuggestions";
import CitySelector from "@/components/CitySelector";
import Link from "next/link";
import ListingDetailModal, { DetailListing } from "@/components/ListingDetailModal";
import MakeOfferModal from "@/components/MakeOfferModal";
import RentalBookingModal from "@/components/rental/RentalBookingModal";
import BuyNowModal from "@/components/BuyNowModal";
import MessageModal from "@/components/MessageModal";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";

// Full listing row (plus its vendor) needed by the detail popup and its CTAs.
const LISTING_SELECT = "id, title, description, type, price, price_label, condition, quantity, images, category, tags, is_featured, cta_type, waiver_url, waiver_filename, sold_at, vendor:vendors(id, slug, business_name, city, state, latitude, longitude, rating, phone, menu_pdf_url)";

type ListingVendor = {
  id: string; slug: string; business_name: string; city: string; state: string;
  latitude: number | null; longitude: number | null; rating: number;
  phone: string | null; menu_pdf_url: string | null;
};

type ListingCtx = { listing: DetailListing & { waiver_url?: string | null; waiver_filename?: string | null }; vendor: ListingVendor };

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
  logo_zoom?: number | null;
  rank: number;
};

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "distance", label: "Nearest" },
  { value: "newest", label: "Newest" },
  { value: "local_bucks", label: "Most Local Bucks" },
];

function ListingCard({ l, onClick }: { l: any; onClick?: () => void }) {
  const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
  const isThrift = l.type === "thrift";
  const isSold = !!l.sold_at || l.quantity === 0;
  const isFree = isThrift && (Number(l.price) === 0);
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 cursor-pointer"
    >
      <div className="h-36 bg-gray-100 relative">
        {l.images?.[0] ? (
          <img src={l.images[0]} alt={l.title} loading="lazy" decoding="async" className={`w-full h-full object-cover ${isSold ? "opacity-60" : ""}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-4xl ${isSold ? "opacity-60" : ""}`}>
            {l.type === "rental" ? "🏠" : isThrift ? "🏷️" : "📦"}
          </div>
        )}
        <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600 capitalize">{l.type}</span>
        {isThrift && l.condition && !isSold && (
          <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">{l.condition}</span>
        )}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-gray-900/85 text-white text-sm font-black tracking-wider px-4 py-1.5 rounded-md -rotate-6 shadow-lg">SOLD</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm">{l.title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{l.category}</p>
        {vendor && (
          <p className="text-xs text-gray-500 mt-1">{vendor.business_name} · {vendor.city}, {vendor.state}</p>
        )}
        {isFree ? (
          <p className="text-sm font-bold text-green-700 mt-2">FREE</p>
        ) : l.price !== null && l.price !== undefined && (
          <p className="text-sm font-bold text-green-700 mt-2">${Number(l.price).toFixed(2)}</p>
        )}
        {l.price_label && !l.price && !isThrift && (
          <p className="text-xs text-gray-500 mt-2">{l.price_label}</p>
        )}
        {isThrift && l.price_label && (
          <p className="text-xs text-gray-500 mt-2">📍 {l.price_label}</p>
        )}
      </div>
    </div>
  );
}

function KeywordListingCard({ r, onClick }: { r: SearchResult; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 cursor-pointer"
    >
      <div className="h-36 bg-gray-100 relative">
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
    </div>
  );
}

function KeywordVendorCard({ r, onClick }: { r: SearchResult; onClick?: () => void }) {
  return (
    <Link
      href={r.slug ? `/vendors/${r.slug}` : "#"}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="h-36 bg-white relative">
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} loading="lazy" decoding="async" className="w-full h-full object-contain p-2 transition-transform" style={{ transform: `scale(${r.logo_zoom ?? 1})` }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏪</div>
        )}
        <span className="absolute top-2 left-2 bg-white text-xs font-medium px-2 py-0.5 rounded-full text-gray-600">business</span>
        {isPaidTier(r.tier) && (
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

const LS_RADIUS_KEY = "el_radius";

export default function SearchClient({ initialCity, initialRadius }: { initialCity?: string; initialRadius?: number }) {
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
  // Radius: URL param > saved profile radius > localStorage (guests) > 50.
  const [radius, setRadius] = useState<number>(() => {
    const fromUrl = searchParams.get("radius");
    if (fromUrl) return Number(fromUrl);
    if (typeof initialRadius === "number") return initialRadius;
    if (typeof window !== "undefined") {
      const fromStorage = localStorage.getItem(LS_RADIUS_KEY);
      if (fromStorage) return Number(fromStorage);
    }
    return 50;
  });
  const [sort, setSort] = useState(searchParams.get("sort") ?? "rating");
  const [userId, setUserId] = useState<string | null>(null);

  // Products/listings section
  const [listingResults, setListingResults] = useState<any[]>([]);
  // Thrift-only filters (price bucket / condition / price sort), applied client-side.
  const [thriftPrice, setThriftPrice] = useState<"" | "free" | "25" | "100">("");
  const [thriftCond, setThriftCond] = useState("");
  const [thriftSort, setThriftSort] = useState<"" | "low" | "high">("");
  // Keyword search: split by result_type
  const [kwListings, setKwListings] = useState<SearchResult[]>([]);
  const [kwVendors, setKwVendors] = useState<SearchResult[]>([]);
  // Geo / browse: vendors section
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Map view of the business results (pins with coords fetched fresh).
  const [mapView, setMapView] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Listing detail popup + action modals — buy/book/message straight from search,
  // no detour through the business page.
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null; email?: string } | null>(null);
  const [detailCtx, setDetailCtx] = useState<ListingCtx | null>(null);
  const [buyCtx, setBuyCtx] = useState<ListingCtx | null>(null);
  const [offerCtx, setOfferCtx] = useState<ListingCtx | null>(null);
  const [estimateCtx, setEstimateCtx] = useState<ListingCtx | null>(null);
  const [bookCtx, setBookCtx] = useState<ListingCtx | null>(null);
  const [bookDurations, setBookDurations] = useState<any[]>([]);
  const [msgCtx, setMsgCtx] = useState<ListingCtx | null>(null);

  function trackListingClick(listingId: string) {
    supabase.rpc("increment_listing_clicks", { listing_id_in: listingId }).then(() => {});
  }

  function openDetail(l: any) {
    const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
    if (!vendor) return;
    setDetailCtx({ listing: l, vendor });
  }

  // Keyword results only carry a summary — fetch the full row, then open.
  async function openDetailById(listingId: string) {
    const { data } = await supabase.from("listings").select(LISTING_SELECT).eq("id", listingId).single();
    if (data) openDetail(data);
  }

  async function openBooking(ctx: ListingCtx) {
    trackListingClick(ctx.listing.id);
    const { data: durations } = await supabase.from("rental_durations").select("*").eq("listing_id", ctx.listing.id).order("hours");
    setBookDurations(durations ?? []);
    setBookCtx(ctx);
  }

  const listingMode = searchParams.get("mode") === "listings";
  const listingType = searchParams.get("type") ?? "";

  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramCity = searchParams.get("city_name") ?? searchParams.get("city") ?? "";
  const paramState = searchParams.get("state") ?? "";

  // activeCityObj: resolved synchronously from the slug (seed or parsed), so
  // filtering works immediately. The DB effect below refines it with exact
  // city casing/punctuation when available.
  const [activeCityObj, setActiveCityObj] = useState<CityOption | undefined>(() => resolveCity(citySlug));

  // Refine the parsed city with the exact DB values (correct casing/punctuation).
  useEffect(() => {
    if (activeCityObj?.city && cityFromSlug(citySlug)) return; // seed city — already exact
    supabase
      .from("vendors")
      .select("city, state")
      .eq("is_active", true)
      .not("city", "is", null)
      .not("state", "is", null)
      .then(({ data }) => {
        for (const row of (data ?? [])) {
          if (!row.city?.trim() || !row.state?.trim()) continue;
          const stateAbbr = normalizeState(row.state.trim());
          if (makeSlug(row.city.trim(), stateAbbr) === citySlug) {
            setActiveCityObj({
              slug: citySlug,
              label: `${row.city.trim()}, ${stateAbbr}`,
              city: row.city.trim(),
              state: stateAbbr,
            });
            return;
          }
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCity = useMemo(() => CITIES.find((c) => c.slug === citySlug), [citySlug]);

  // Center coords for the active city, resolved (and cached) via /api/cities/resolve.
  const [cityCenter, setCityCenter] = useState<CityCenter | null>(null);
  useEffect(() => {
    if (!activeCityObj) { setCityCenter(null); return; }
    let cancelled = false;
    fetchCityCenter(activeCityObj).then((c) => { if (!cancelled) setCityCenter(c); });
    return () => { cancelled = true; };
  }, [activeCityObj?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedCoords = useMemo(() => {
    if (cityCenter && activeCityObj) {
      return { latitude: cityCenter.latitude, longitude: cityCenter.longitude, label: activeCityObj.label };
    }
    if (selectedCity) {
      return { latitude: selectedCity.latitude, longitude: selectedCity.longitude, label: `${selectedCity.name}, ${selectedCity.state}` };
    }
    if (paramLat && paramLng) {
      return { latitude: Number(paramLat), longitude: Number(paramLng), label: [paramCity, paramState].filter(Boolean).join(", ") };
    }
    return null;
  }, [cityCenter, activeCityObj, selectedCity, paramLat, paramLng, paramCity, paramState]);

  // On mount: get user id for profile saves + profile for the action modals
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("id", user.id).single();
      if (profile) setCurrentUser({ ...profile, email: user.email });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the last place they searched — persist the active city + radius to
  // their profile (and localStorage for guests) on any change, not just when
  // they use the selector. This restores their location on login / return.
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, citySlug);
    if (userId) {
      supabase.from("profiles").update({ default_city: citySlug }).eq("id", userId).then(() => {});
    }
  }, [citySlug, userId, supabase]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_RADIUS_KEY, String(radius));
    if (userId) {
      supabase.from("profiles").update({ default_radius: radius }).eq("id", userId).then(() => {});
    }
  }, [radius, userId, supabase]);

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

  // A listing is in-range if its vendor is within `radius` miles of the city
  // center. Vendors without coordinates (not yet geocoded) fall back to an
  // exact city/state match so they still surface in their own town.
  const listingInRange = useCallback((l: any) => {
    const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
    if (resolvedCoords && v?.latitude != null && v?.longitude != null) {
      return distanceMiles(resolvedCoords.latitude, resolvedCoords.longitude, v.latitude, v.longitude) <= radius;
    }
    if (activeCityObj) {
      return v?.city?.toLowerCase() === activeCityObj.city.toLowerCase()
        && normalizeState(v?.state ?? "") === activeCityObj.state;
    }
    return true;
  }, [resolvedCoords, radius, activeCityObj]);

  const runSearch = useCallback(async () => {
    setLoading(true);

    try {
      // Category pill / listing-type browse — show listings only (products first, no vendor section)
      if (listingMode) {
        let q = supabase
          .from("listings")
          .select(LISTING_SELECT)
          .eq("is_active", true);
        if (listingType) q = q.eq("type", listingType);
        else if (category) q = q.eq("category", category);
        q = q.order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(80);
        const { data } = await q;
        const inRange = (data ?? []).filter(listingInRange);
        setListingResults(inRange);
        setKwListings([]);
        setKwVendors([]);
        setVendors([]);
        trackSearch({
          query: "",
          mode: "listings",
          type: listingType || undefined,
          category: category || undefined,
          city: activeCityObj?.label,
          radius,
          result_count: inRange.length,
        });
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
          p_radius_miles: radius,
        });
        const results: SearchResult[] = data ?? [];
        const listings = results.filter((r) => r.result_type === "listing");
        const vendorResults = results
          .filter((r) => r.result_type === "vendor")
          .sort((a, b) => (isPaidTier(b.tier) ? 1 : 0) - (isPaidTier(a.tier) ? 1 : 0));
        setKwListings(listings);
        setKwVendors(vendorResults);
        setListingResults([]);
        setVendors([]);
        trackSearch({
          query: query.trim(),
          category: category || undefined,
          city: activeCityObj?.label ?? citySlug,
          radius,
          result_count: results.length,
        });
      } else if (resolvedCoords) {
        // Geo/nearby mode — vendors within `radius` miles (via RPC), and
        // listings whose vendor falls within the same radius.
        let geoListingQ = supabase
          .from("listings")
          .select(LISTING_SELECT)
          .eq("is_active", true);
        if (category) geoListingQ = geoListingQ.eq("category", category);
        geoListingQ = geoListingQ
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(80);

        const [listingRes, vendorRes] = await Promise.all([
          geoListingQ,
          supabase.rpc("search_vendors_nearby", {
            p_latitude: resolvedCoords.latitude,
            p_longitude: resolvedCoords.longitude,
            p_radius_miles: radius,
            p_category: category || null,
            p_limit: 40,
            p_offset: 0,
          }),
        ]);

        const filteredListings = (listingRes.data ?? []).filter(listingInRange);

        // RPC already returns only vendors within radius, sorted by distance.
        let nearbyVendors: Vendor[] = vendorRes.data ?? [];
        if (sort === "rating") nearbyVendors.sort((a, b) => b.rating - a.rating);
        else if (sort === "distance") nearbyVendors.sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));
        else if (sort === "local_bucks") nearbyVendors.sort((a, b) => b.local_bucks_earned - a.local_bucks_earned);

        setListingResults(filteredListings);
        setVendors(nearbyVendors);
        setKwListings([]);
        setKwVendors([]);
        trackSearch({
          query: "",
          mode: "geo",
          category: category || undefined,
          city: resolvedCoords.label,
          radius,
          result_count: filteredListings.length + nearbyVendors.length,
        });
      } else {
        // Fallback: no resolvable center (geocoding pending/failed) — exact-city browse.
        let vendorQ = supabase
          .from("vendors")
          .select("*")
          .eq("is_active", true)
          .order("tier", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12);
        if (activeCityObj) {
          vendorQ = vendorQ.ilike("city", activeCityObj.city);
        }

        let fbListingQ = supabase
          .from("listings")
          .select(LISTING_SELECT)
          .eq("is_active", true);
        if (category) fbListingQ = fbListingQ.eq("category", category);
        fbListingQ = fbListingQ
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(80);

        const [listingRes, vendorRes] = await Promise.all([
          fbListingQ,
          vendorQ,
        ]);

        const filteredListings = (listingRes.data ?? []).filter(listingInRange);

        let browseVendors: Vendor[] = (vendorRes.data ?? []).filter((v: Vendor) =>
          !activeCityObj || normalizeState(v.state ?? "") === activeCityObj.state
        );
        if (category) browseVendors = browseVendors.filter((v) => v.category === category);
        setListingResults(filteredListings);
        setVendors(browseVendors);
        setKwListings([]);
        setKwVendors([]);
        trackSearch({
          query: "",
          mode: "browse",
          category: category || undefined,
          city: activeCityObj?.label,
          radius,
          result_count: filteredListings.length + browseVendors.length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [query, citySlug, category, radius, sort, selectedCity, supabase, listingMode, listingType, resolvedCoords, activeCityObj, listingInRange]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  // Derived counts for results header
  const isKeyword = !!query.trim() && !listingMode;
  const isThriftView = listingMode && listingType === "thrift";

  // Build map pins for the business results — fetch coords fresh so it works for
  // browse, radius (RPC has no coords), and keyword paths alike.
  useEffect(() => {
    if (!mapView) { return; }
    const list: any[] = isKeyword ? kwVendors : vendors;
    const ids = list.map((x) => x.id).filter(Boolean);
    if (ids.length === 0) { setMapMarkers([]); return; }
    let cancel = false;
    supabase.from("vendors").select("id, business_name, slug, latitude, longitude, city, state").in("id", ids)
      .then(({ data }) => {
        if (cancel) return;
        setMapMarkers((data ?? [])
          .filter((v: any) => v.latitude != null && v.longitude != null)
          .map((v: any) => ({ lat: v.latitude, lng: v.longitude, title: v.business_name, href: `/vendors/${v.slug}`, subtitle: `${v.city}, ${v.state}` })));
      });
    return () => { cancel = true; };
  }, [mapView, isKeyword, vendors, kwVendors, supabase]);

  // Apply thrift-only price/condition/sort filters to the listing grid.
  const shownListings = useMemo(() => {
    if (!isThriftView) return listingResults;
    let arr = listingResults;
    if (thriftPrice === "free") arr = arr.filter((l) => Number(l.price) === 0);
    else if (thriftPrice === "25") arr = arr.filter((l) => l.price != null && Number(l.price) <= 25);
    else if (thriftPrice === "100") arr = arr.filter((l) => l.price != null && Number(l.price) <= 100);
    if (thriftCond) arr = arr.filter((l) => (l.condition ?? "").toLowerCase() === thriftCond.toLowerCase());
    if (thriftSort === "low") arr = [...arr].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    else if (thriftSort === "high") arr = [...arr].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    return arr;
  }, [isThriftView, listingResults, thriftPrice, thriftCond, thriftSort]);

  const productCount = listingMode
    ? shownListings.length
    : isKeyword
    ? kwListings.length
    : listingResults.length;
  const bizCount = isKeyword ? kwVendors.length : vendors.length;

  // Radius control: users pick how far out to look; "See more further away"
  // widens it in steps and re-runs the search (radius is a runSearch dep).
  const RADIUS_STEPS = [10, 25, 50, 100, 200, 500];
  const hasLocationContext = !!(activeCityObj || resolvedCoords);
  const locationLabel = activeCityObj?.label ?? resolvedCoords?.label ?? "";
  function setRadiusTo(next: number) { setRadius(next); updateURL({ radius: String(next) }); }
  function seeFurther() {
    const next = RADIUS_STEPS.find((r) => r > radius) ?? RADIUS_STEPS[RADIUS_STEPS.length - 1];
    setRadiusTo(next);
  }
  const canSeeFurther = radius < RADIUS_STEPS[RADIUS_STEPS.length - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Listing detail popup + action modals */}
      {detailCtx && (
        <ListingDetailModal
          listing={detailCtx.listing}
          vendorPhone={detailCtx.vendor.phone}
          menuPdfUrl={detailCtx.vendor.menu_pdf_url}
          vendorName={detailCtx.vendor.business_name}
          vendorSlug={detailCtx.vendor.slug}
          cartVendor={{ id: detailCtx.vendor.id, name: detailCtx.vendor.business_name, slug: detailCtx.vendor.slug }}
          onClose={() => setDetailCtx(null)}
          onBook={() => { const ctx = detailCtx; setDetailCtx(null); openBooking(ctx); }}
          onBuy={() => { const ctx = detailCtx; setDetailCtx(null); trackListingClick(ctx.listing.id); setBuyCtx(ctx); }}
          onEstimate={() => { const ctx = detailCtx; setDetailCtx(null); trackListingClick(ctx.listing.id); setEstimateCtx(ctx); }}
          onMakeOffer={() => { const ctx = detailCtx; setDetailCtx(null); trackListingClick(ctx.listing.id); setOfferCtx(ctx); }}
          onMessage={() => { const ctx = detailCtx; setDetailCtx(null); trackListingClick(ctx.listing.id); setMsgCtx(ctx); }}
        />
      )}
      {offerCtx && (
        <MakeOfferModal
          listing={{ id: offerCtx.listing.id, title: offerCtx.listing.title, price: offerCtx.listing.price }}
          vendor={{ id: offerCtx.vendor.id, business_name: offerCtx.vendor.business_name }}
          currentUser={currentUser}
          onClose={() => setOfferCtx(null)}
        />
      )}
      {buyCtx && (
        <BuyNowModal
          listing={{ id: buyCtx.listing.id, title: buyCtx.listing.title, price: buyCtx.listing.price, price_label: buyCtx.listing.price_label }}
          vendor={{ id: buyCtx.vendor.id, business_name: buyCtx.vendor.business_name }}
          currentUser={currentUser}
          inquiryType="buy"
          onClose={() => setBuyCtx(null)}
        />
      )}
      {estimateCtx && (
        <BuyNowModal
          listing={{ id: estimateCtx.listing.id, title: estimateCtx.listing.title, price: estimateCtx.listing.price, price_label: estimateCtx.listing.price_label }}
          vendor={{ id: estimateCtx.vendor.id, business_name: estimateCtx.vendor.business_name }}
          currentUser={currentUser}
          inquiryType="estimate"
          onClose={() => setEstimateCtx(null)}
        />
      )}
      {bookCtx && (
        <RentalBookingModal
          listing={{ id: bookCtx.listing.id, title: bookCtx.listing.title, waiver_url: bookCtx.listing.waiver_url ?? null, waiver_filename: bookCtx.listing.waiver_filename ?? null }}
          vendor={{ id: bookCtx.vendor.id, business_name: bookCtx.vendor.business_name }}
          durations={bookDurations}
          currentUser={currentUser}
          onClose={() => setBookCtx(null)}
        />
      )}
      {msgCtx && (
        <MessageModal
          listing={{ id: msgCtx.listing.id, title: msgCtx.listing.title }}
          vendor={{ id: msgCtx.vendor.id, business_name: msgCtx.vendor.business_name }}
          currentUser={currentUser}
          onClose={() => setMsgCtx(null)}
        />
      )}

      {/* Top bar (sits below the global header) */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Row 1: search bar / filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  updateURL({ q: v });
                }}
                onSearch={runSearch}
                placeholder="Ask Mike — plumber, fresh eggs, haircut…"
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

      {/* Ask Mike suggestions — shown before the shopper has typed anything */}
      {!query.trim() && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <SearchSuggestions
              citySlug={citySlug}
              cityLabel={resolveCity(citySlug)?.label}
              align="start"
              onPick={(term) => { setQuery(term); updateURL({ q: term }); }}
            />
          </div>
        </div>
      )}

      {/* Category pills */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            <button
              onClick={() => { track("category_pill_click", { category: "All", source: "search" }); setCategory(""); updateURL({ category: "", type: "", mode: "" }); }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !category && !listingMode ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { track("category_pill_click", { category: c, source: "search" }); setCategory(c); updateURL({ category: c, mode: "", type: "" }); }}
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

      {/* Thrift-only filter bar: price bucket, condition, price sort */}
      {isThriftView && (
        <div className="bg-amber-50/60 border-b border-amber-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide items-center">
            <span className="shrink-0 text-xs font-bold text-amber-700 mr-1">🏷️ Thrift</span>
            {([["", "Any price"], ["free", "Free"], ["25", "Under $25"], ["100", "Under $100"]] as const).map(([val, label]) => (
              <button key={val || "any"} onClick={() => setThriftPrice(val)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${thriftPrice === val ? "bg-amber-500 text-white" : "bg-white text-gray-600 border border-amber-200 hover:bg-amber-100"}`}>
                {label}
              </button>
            ))}
            <span className="shrink-0 w-px h-5 bg-amber-200 mx-1" />
            <select value={thriftCond} onChange={(e) => setThriftCond(e.target.value)}
              className="shrink-0 text-xs font-medium bg-white border border-amber-200 rounded-full px-3 py-1.5 text-gray-600 focus:outline-none">
              <option value="">Any condition</option>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
            </select>
            <select value={thriftSort} onChange={(e) => setThriftSort(e.target.value as "" | "low" | "high")}
              className="shrink-0 text-xs font-medium bg-white border border-amber-200 rounded-full px-3 py-1.5 text-gray-600 focus:outline-none">
              <option value="">Sort</option>
              <option value="low">Price: Low → High</option>
              <option value="high">Price: High → Low</option>
            </select>
          </div>
        </div>
      )}

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
            {(listingMode ? shownListings : isKeyword ? kwListings : listingResults).length > 0 ? (
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
                        : category
                        ? `${category}`
                        : "Latest Products"}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {productCount} {productCount === 1 ? "result" : "results"}
                      {hasLocationContext ? ` within ${radius} mi of ${locationLabel}` : ""}
                    </p>
                    {hasLocationContext && (
                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        <span className="text-xs text-gray-400">Distance:</span>
                        <select
                          value={radius}
                          onChange={(e) => setRadiusTo(Number(e.target.value))}
                          className="text-xs font-medium border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          {RADIUS_STEPS.map((r) => (
                            <option key={r} value={r}>Within {r} mi</option>
                          ))}
                        </select>
                        {canSeeFurther && (
                          <button
                            onClick={seeFurther}
                            className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline"
                          >
                            See more further away →
                          </button>
                        )}
                      </div>
                    )}
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
                    ? shownListings.map((l: any, i: number) => (
                        <ListingCard key={l.id} l={l} onClick={() => { track("search_result_click", {
                          query: "",
                          mode: "listings",
                          result_type: "listing",
                          result_id: l.id,
                          position: i + 1,
                          total_results: shownListings.length,
                        }); openDetail(l); }} />
                      ))
                    : isKeyword
                    ? kwListings.map((r, i) => (
                        <KeywordListingCard key={r.id} r={r} onClick={() => { track("search_result_click", {
                          query: query.trim(),
                          result_type: "listing",
                          result_id: r.id,
                          slug: r.slug ?? null,
                          position: i + 1,
                          total_results: kwListings.length,
                        }); openDetailById(r.id); }} />
                      ))
                    : listingResults.map((l: any, i: number) => (
                        <ListingCard key={l.id} l={l} onClick={() => { track("search_result_click", {
                          query: "",
                          mode: "browse",
                          result_type: "listing",
                          result_id: l.id,
                          position: i + 1,
                          total_results: listingResults.length,
                        }); openDetail(l); }} />
                      ))}
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
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Local Businesses</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {bizCount} {bizCount === 1 ? "business" : "businesses"}
                      {activeCityObj ? ` within ${radius} mi of ${activeCityObj.label}` : resolvedCoords ? ` near ${resolvedCoords.label}` : ""} · Featured first
                    </p>
                  </div>
                  <div className="shrink-0 inline-flex rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold">
                    <button onClick={() => setMapView(false)} className={`px-3 py-1.5 transition-colors ${!mapView ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>List</button>
                    <button onClick={() => setMapView(true)} className={`px-3 py-1.5 transition-colors ${mapView ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>🗺️ Map</button>
                  </div>
                </div>
                {mapView ? (
                  mapMarkers.length > 0 ? (
                    <LeafletMap markers={mapMarkers} height={520} />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-2xl">No mapped locations for these businesses.</div>
                  )
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {isKeyword
                    ? kwVendors.map((r, i) => (
                        <KeywordVendorCard key={r.id} r={r} onClick={() => track("search_result_click", {
                          query: query.trim(),
                          result_type: "vendor",
                          result_id: r.id,
                          slug: r.slug ?? null,
                          position: i + 1,
                          total_results: kwVendors.length,
                        })} />
                      ))
                    : vendors.map((v, i) => (
                        <div
                          key={v.id}
                          onClickCapture={() => track("search_result_click", {
                            query: "",
                            mode: resolvedCoords ? "geo" : "browse",
                            result_type: "vendor",
                            result_id: v.id,
                            slug: v.slug,
                            position: i + 1,
                            total_results: vendors.length,
                          })}
                        >
                          <VendorCard vendor={v} />
                        </div>
                      ))}
                </div>
                )}
              </section>
            )}

            {/* ── EMPTY STATE ── */}
            {!loading && !listingMode && productCount === 0 && bizCount === 0 && (
              <div className="text-center py-24">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {query
                    ? hasLocationContext
                      ? `No matches for "${query}" within ${radius} mi of ${locationLabel}.`
                      : `No products or businesses matched "${query}". Try different keywords.`
                    : "No listings in this area yet. Be the first to list your business!"}
                </p>
                {hasLocationContext && canSeeFurther && (
                  <button
                    onClick={seeFurther}
                    className="inline-block mb-4 mr-2 border border-green-300 text-green-700 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-green-50 transition-colors"
                  >
                    🔎 See more further away →
                  </button>
                )}
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
