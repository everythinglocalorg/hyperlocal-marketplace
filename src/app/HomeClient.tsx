"use client";

import { useState, useEffect, useRef, useMemo, type ComponentType } from "react";
import Link from "next/link";
import { useFavorites } from "@/lib/favorites";
import Logo from "@/components/Logo";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { resolveCity, normalizeState, fetchCityCenter, distanceMiles, DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";
import CitySelector from "@/components/CitySelector";
import AtMentionDropdown from "@/components/AtMentionDropdown";
import SearchPredictive from "@/components/search/SearchPredictive";
import { LocalProPriceInline } from "@/components/LocalProPrice";
import VendorLogo from "@/components/vendor/VendorLogo";
import TypedRotator from "@/components/TypedRotator";
import WelcomeGateModal from "@/components/WelcomeGateModal";
import SearchSuggestions from "@/components/SearchSuggestions";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";
import QuickSellFab from "@/components/QuickSellFab";
import CategoryBubbles from "@/components/home/CategoryBubbles";
import ProductTour, { type TourStep } from "@/components/ProductTour";
import { Sofa, Truck, Tag, Sprout, Shirt, Package, Wrench, UtensilsCrossed, PawPrint, Car, Sparkles, PartyPopper, Palette, Home as HomeIcon, LayoutGrid, Baby } from "lucide-react";

// Custom lucide-style icon for Food Products: a honeycomb cell with honey
// dripping off the bottom. Takes the same props as the lucide icons so it drops
// straight into the category bubbles.
function HoneycombIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* three tiled honeycomb cells */}
      <path d="M8.5 3.4 11.3 5 11.3 8.2 8.5 9.8 5.7 8.2 5.7 5Z" />
      <path d="M15.5 3.4 18.3 5 18.3 8.2 15.5 9.8 12.7 8.2 12.7 5Z" />
      <path d="M12 8.6 14.8 10.2 14.8 13.4 12 15 9.2 13.4 9.2 10.2Z" />
      {/* drippy honey off the bottom cell */}
      <path d="M12 15c-1 1.9-1.6 2.8-1.6 3.9a1.6 1.6 0 0 0 3.2 0c0-1.1-.6-2-1.6-3.9" fill="currentColor" stroke="none" />
      <path d="M9.2 13.4c-.6 1.3-1 1.9-1 2.7a1 1 0 0 0 2 0c0-.8-.4-1.4-1-2.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Custom chicken/hen icon for the Livestock bubble (lucide has no chicken).
function ChickenIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* comb */}
      <path d="M13.5 4.5c.2-.9 1.1-.9 1.4-.1.2-.9 1.2-.9 1.4 0" />
      {/* head + body silhouette */}
      <path d="M4.5 13.2C4.5 9.6 7.3 7.1 10.8 7.2 11.3 5.4 13 4.2 15 4.4 16.8 4.6 18 6 18 7.6 18 8 17.9 8.3 17.7 8.6L19.4 9.1C20.1 9.4 20.1 10.3 19.4 10.6L17.6 11.2C17.8 14.8 15 17.8 11.3 17.9 7.4 18 4.5 16.8 4.5 13.2Z" />
      {/* beak */}
      <path d="M18 6.4 20 6.9 18.2 7.7" />
      {/* eye */}
      <circle cx="15.6" cy="6.7" r="0.65" fill="currentColor" stroke="none" />
      {/* tail feathers */}
      <path d="M4.5 13.2C3.1 12.6 2.6 11 3.2 9.5" />
      <path d="M4.9 11.1C3.8 10.5 3.4 9.3 3.7 8.1" />
      {/* wing */}
      <path d="M8.8 12.3c1.4 0 2.6.8 3.3 2" />
      {/* legs */}
      <path d="M9.4 17.9v2.6M9.4 20.5l-1.2 1M9.4 20.5l1.2 1" />
      <path d="M12.6 17.9v2.6M12.6 20.5l-1.2 1M12.6 20.5l1.2 1" />
    </svg>
  );
}

// Custom American-football icon for the Sports bubble.
function FootballIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* ball */}
      <path d="M3 12C6 7 18 7 21 12 18 17 6 17 3 12Z" />
      {/* laces */}
      <path d="M9.5 12h5" />
      <path d="M10.8 10.9v2.2M12 10.9v2.2M13.2 10.9v2.2" />
    </svg>
  );
}

// First-run guided tour, shown once right after onboarding (flag set on finish).
const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="home"]', title: "Welcome home 🏡", body: "This is your home base — the best local shops, food, and finds near you, all in one place." },
  { selector: '[data-tour="search"]', title: "Search anything 🔎", body: "Look up any product, service, or business right here — or type @ to find a specific person or shop." },
  { selector: '[data-tour="wishlist"]', title: "Your Wish List 💚", body: "Tap the heart on anything you love and it's saved here for later." },
  { selector: '[data-tour="messages"]', title: "Messages 💬", body: "Chat directly with local businesses — ask questions, get quotes, place orders." },
  { selector: '[data-tour="notifications"]', title: "Notifications 🔔", body: "Order updates, replies, and local alerts all land here." },
  { selector: '[data-tour="menu"]', title: "Everything else ☰", body: "Almost everything else — Local Pages (community & events), Local Jobs, Explore, and your Dashboard — lives in this menu." },
];

// Rotating hero categories — "Discover the best ___ in {City}." keeps the town
// fixed and types through these one after another.
const HERO_PHRASES = [
  "home services",
  "coffee shops",
  "restaurants",
  "rentals",
  "hidden gems",
  "thrift sales",
  "hair stylists",
  "wedding venues",
  "date-night spots",
  "food trucks",
  "breweries & taprooms",
];

function milesLabel(mi: number | null | undefined): string | null {
  if (mi == null || !isFinite(mi)) return null;
  if (mi < 0.1) return "Right here";
  const val = mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();
  return `${val} mi away`;
}

// Airbnb-style save heart on Featured Gems, wired to the Wish List.
function GemHeart({ listingId }: { listingId: string }) {
  const favorites = useFavorites();
  const saved = favorites.isSaved(listingId);
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await favorites.toggleWishlist(listingId);
    if (res === "login") window.location.href = "/login";
  }
  return (
    <button type="button" onClick={toggle}
      aria-label={saved ? "Remove from Wish List" : "Save to Wish List"}
      className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
      <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        fill={saved ? "#16a34a" : "rgba(0,0,0,0.35)"} stroke="#fff" strokeWidth="2">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  "Products": "📦",
  "Services & Trades": "🔧",
  "Restaurants": "🍽️",
  "Food Products": "🍯",
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
  "Animals": "🐴",
};

export default function HomeClient({ initialListings, initialVendors, initialBlog }: {
  initialListings: any[]; initialVendors: any[]; initialBlog: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  // Inline search / "view all" results shown IN PLACE on the home page (no jump
  // to /search). Driven by ?q= for keyword search (so back/forward works) and by
  // the "View all" button for a whole bubble. `source` tells clear how to reset.
  type InlineCard = { id: string; href: string; image: string | null; title: string; subtitle: string; vendorName?: string | null; price?: number | null; priceLabel?: string | null };
  const [inline, setInline] = useState<{ title: string; cards: InlineCard[]; source: "q" | "all" } | null>(null);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string | null; role: string | null } | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  // Seeded with server-fetched content so the page paints real listings/vendors
  // immediately; the mount effect below re-personalizes to the visitor's saved city.
  const [recentListings, setRecentListings] = useState<any[]>(initialListings);
  const [newVendors, setNewVendors] = useState<any[]>(initialVendors);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);
  const [radius, setRadius] = useState(50);
  const [showTour, setShowTour] = useState(false);
  const scrollRestored = useRef(false);

  // After returning from a listing, drop the feed back where they left off.
  useEffect(() => {
    if (scrollRestored.current || recentListings.length === 0) return;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem("el_home_scroll"); } catch { /* noop */ }
    if (saved) {
      scrollRestored.current = true;
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved as string, 10));
        try { sessionStorage.removeItem("el_home_scroll"); } catch { /* noop */ }
      });
    }
  }, [recentListings]);

  // First-run tour: onboarding sets el_tour_pending; show it once, then mark done.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const pending = localStorage.getItem("el_tour_pending") === "1" || url.searchParams.get("tour") === "1";
      const done = localStorage.getItem("el_tour_done") === "1";
      if (pending && !done) {
        localStorage.removeItem("el_tour_pending");
        // Let the header + hero mount and paint before spotlighting.
        const t = setTimeout(() => setShowTour(true), 600);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, []);

  // Businesses near the active city, plotted on the map.
  useEffect(() => {
    const supabase = createClient();
    const cityObj = resolveCity(activeCity);
    let q = supabase
      .from("vendors")
      .select("business_name, slug, latitude, longitude, city, state")
      .eq("is_active", true)
      .not("latitude", "is", null)
      .limit(60);
    if (cityObj) q = q.ilike("city", cityObj.city);
    q.then(({ data }) => setMapMarkers(
      (data ?? []).map((v: any) => ({ lat: v.latitude, lng: v.longitude, title: v.business_name, href: `/vendors/${v.slug}`, subtitle: `${v.city}, ${v.state}` }))
    ));
  }, [activeCity]);
  const [blogPosts] = useState<any[]>(initialBlog);

  // Soft signup gate: guests see the welcome modal before searching/browsing.
  const [gateNext, setGateNext] = useState<string | null>(null);
  // Hard gate: a few seconds after a guest lands on home, require an account to
  // go further (can't be dismissed). Signup + login both live in the modal.
  const [autoGate, setAutoGate] = useState(false);

  useEffect(() => {
    if (!authChecked || user) return;
    const t = setTimeout(() => setAutoGate(true), 2500);
    return () => clearTimeout(t);
  }, [authChecked, user]);

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
          .select("full_name, role, city, state, default_city, default_radius")
          .eq("id", u.id)
          .single();
        setUser({ id: u.id, name: profile?.full_name ?? u.email ?? null, role: profile?.role ?? null });
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("is_read", false)
          .then(({ count }) => setNotifUnread(count ?? 0));
        if (profile?.default_city) resolvedCitySlug = profile.default_city;
        if (typeof profile?.default_radius === "number") setRadius(profile.default_radius);
      }
      setAuthChecked(true);
      setActiveCity(resolvedCitySlug);
      loadCityData(resolvedCitySlug);
    });
  }, []);

  // Load recent listings + new vendors within `radius` miles of a city's center.
  // Vendors without coordinates fall back to an exact city/state match.
  async function loadCityData(slug: string, radiusArg: number = radius) {
    const supabase = createClient();
    const cityObj = resolveCity(slug);
    const center = cityObj ? await fetchCityCenter(cityObj) : null;

    const inRange = (v: any) => {
      if (center && v?.latitude != null && v?.longitude != null) {
        return distanceMiles(center.latitude, center.longitude, v.latitude, v.longitude) <= radiusArg;
      }
      if (cityObj) {
        return v?.city?.toLowerCase() === cityObj.city.toLowerCase() && normalizeState(v?.state ?? "") === cityObj.state;
      }
      return true;
    };

    // Recent listings — filter by the vendor's distance from the city center
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title, description, price, price_label, images, type, category, vendor:vendors(business_name, slug, city, state, latitude, longitude, category)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200);
    const filteredListings = (listings ?? []).filter((l: any) => {
      const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
      return v?.slug && inRange(v);
    });
    // Paid boosts for this town surface first, blended with the new items.
    const { data: boosts } = await supabase
      .from("featured_boosts")
      .select("entity_type, entity_id")
      .eq("placement", "homepage")
      .eq("is_active", true)
      .eq("city_slug", slug);
    const boostedListingIds = (boosts ?? []).filter((b: any) => b.entity_type === "listing").map((b: any) => b.entity_id);
    const boostedVendorIds = (boosts ?? []).filter((b: any) => b.entity_type === "vendor").map((b: any) => b.entity_id);

    // Featured Gems — boosted products first, then recent ones.
    let boostedListings: any[] = [];
    if (boostedListingIds.length) {
      const { data: bl } = await supabase
        .from("listings")
        .select("id, title, description, price, price_label, images, type, category, vendor:vendors(business_name, slug, city, state, latitude, longitude, category)")
        .in("id", boostedListingIds)
        .eq("is_active", true);
      boostedListings = (bl ?? [])
        .filter((l: any) => (Array.isArray(l.vendor) ? l.vendor[0] : l.vendor)?.slug)
        .map((l: any) => ({ ...l, boosted: true }));
    }
    const restListings = filteredListings.filter((l: any) => !boostedListingIds.includes(l.id));
    const withDist = (l: any) => {
      const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
      const dist = center && v?.latitude != null && v?.longitude != null
        ? distanceMiles(center.latitude, center.longitude, v.latitude, v.longitude)
        : null;
      return { ...l, __dist: dist };
    };
    setRecentListings([...boostedListings, ...restListings].map(withDist).slice(0, 60));

    // Boosted businesses lead the New Businesses row.
    let boostedVendors: any[] = [];
    if (boostedVendorIds.length) {
      const { data: bv } = await supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, category, city, state, rating")
        .in("id", boostedVendorIds)
        .eq("is_active", true);
      boostedVendors = (bv ?? []).filter((v: any) => v.slug).map((v: any) => ({ ...v, boosted: true }));
    }
    const blendVendors = (list: any[]) => {
      const rest = (list ?? []).filter((v: any) => !boostedVendorIds.includes(v.id));
      setNewVendors([...boostedVendors, ...rest].slice(0, 6));
    };

    // New vendors — use the radius RPC when we have a center, else exact-city
    if (center) {
      const { data } = await supabase.rpc("search_vendors_nearby", {
        p_latitude: center.latitude,
        p_longitude: center.longitude,
        p_radius_miles: radiusArg,
        p_limit: 6,
        p_offset: 0,
      });
      blendVendors((data ?? []).filter((v: any) => v.slug));
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
      blendVendors(data ?? []);
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

  // Radius changed from the town selector — re-filter the grid with the new range.
  function handleRadiusChange(r: number) {
    setRadius(r);
    if (user) {
      const supabase = createClient();
      supabase.from("profiles").update({ default_radius: r }).eq("id", user.id);
    }
    loadCityData(activeCity, r);
  }

  // Searching stays on the home page: push ?q= and let the effect below fetch +
  // render results in place. Clearing (empty) resets to the normal home.
  function goSearch(term: string) {
    const q = term.trim();
    if (!q) { clearInline(); return; }
    if (gate(`/?q=${encodeURIComponent(q)}`)) return;
    router.push(`/?q=${encodeURIComponent(q)}`);
  }
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    goSearch(query);
  }

  function clearInline() {
    setInline(null);
    setQuery("");
    if (searchParams.get("q")) router.push("/");
  }

  // Run the keyword search in place whenever ?q= changes (reuses the same
  // keyword_search RPC the /search page uses).
  useEffect(() => {
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) { setInline((prev) => (prev?.source === "q" ? null : prev)); return; }
    setQuery(q);
    let cancelled = false;
    setInlineLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("keyword_search", {
        p_query: q, p_city_slug: activeCity || null, p_type: "all", p_limit: 40, p_offset: 0, p_radius_miles: radius,
      });
      if (cancelled) return;
      const cards: InlineCard[] = (data ?? []).map((r: any) => r.result_type === "vendor"
        ? { id: r.id, href: `/vendors/${r.slug}`, image: r.image_url ?? null, title: r.title, subtitle: [r.city, r.state].filter(Boolean).join(", "), price: null }
        : { id: r.id, href: `/listings/${r.id}`, image: r.image_url ?? null, title: r.title, subtitle: [r.city, r.state].filter(Boolean).join(", "), vendorName: r.business_name ?? null, price: null });
      setInline({ title: `Results for “${q}”`, cards, source: "q" });
      setInlineLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeCity, radius]);

  // "View all" for the active bubble — show the whole category in place.
  async function runViewAll() {
    setInlineLoading(true);
    setInline({ title: `All ${activeCategory?.label ?? "listings"}`, cards: [], source: "all" });
    const supabase = createClient();
    let q = supabase
      .from("listings")
      .select("id, title, price, price_label, images, type, vendor:vendors(business_name, slug, city, state)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(120);
    if (activeCategory?.type) q = q.eq("type", activeCategory.type);
    else if (activeCategory?.category) q = q.eq("category", activeCategory.category);
    const { data } = await q;
    const cards: InlineCard[] = (data ?? []).map((l: any) => {
      const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
      return { id: l.id, href: `/listings/${l.id}`, image: l.images?.[0] ?? null, title: l.title, subtitle: v?.city ? `${v.city}, ${v.state}` : "", vendorName: v?.business_name ?? null, price: l.price, priceLabel: l.price_label };
    });
    setInline({ title: `All ${activeCategory?.label ?? "listings"}`, cards, source: "all" });
    setInlineLoading(false);
  }

  // Category bubbles filter the Featured Gems grid IN PLACE (no jump to
  // the discovery page). A filter matches a listing by its type, its category,
  // or a keyword in the title/description. `null` = All (show everything).
  type CatFilter = { label: string; type?: string; category?: string; keywords?: string[] };
  const [activeCategory, setActiveCategory] = useState<CatFilter | null>(null);

  function matchFilter(l: any, f: CatFilter | null): boolean {
    if (!f) return true;
    if (f.type && l.type === f.type) return true;
    const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
    if (f.category && (l.category === f.category || v?.category === f.category)) return true;
    if (f.keywords) {
      const hay = `${l.title ?? ""} ${l.description ?? ""} ${l.category ?? ""}`.toLowerCase();
      if (f.keywords.some((k) => hay.includes(k))) return true;
    }
    return false;
  }

  const displayedListings = useMemo(
    () => (activeCategory ? recentListings.filter((l) => matchFilter(l, activeCategory)).slice(0, 24) : recentListings.slice(0, 8)),
    [recentListings, activeCategory]
  );

  function pickCategory(f: CatFilter | null) {
    track("category_pill_click", { category: f?.label ?? "All", source: "homepage" });
    setActiveCategory(f);
  }

  // "View all →" carries the active filter through to the full discovery page.
  function gemsViewAllHref() {
    const p = new URLSearchParams();
    if (activeCity) p.set("city", activeCity);
    if (activeCategory?.type) { p.set("type", activeCategory.type); p.set("mode", "listings"); }
    else if (activeCategory?.category) { p.set("category", activeCategory.category); p.set("mode", "listings"); }
    return `/search?${p.toString()}`;
  }

  // Canonical category set — one list drives BOTH the mobile bubble row and the
  // desktop row (same icons + behavior). Order: a few pinned leaders, then the
  // rest alphabetically. Food Trucks is a separate vendor board (nav, not filter).
  const CAT_NAV: { label: string; Icon: ComponentType<{ className?: string; strokeWidth?: number }>; filter?: CatFilter | null; nav?: string }[] = [
    { label: "All", Icon: LayoutGrid, filter: null },
    { label: "Home Goods", Icon: Sofa, filter: { label: "Home Goods", category: "Home & Garden", keywords: ["home goods", "furniture", "home decor", "decor", "household", "kitchen", "appliance"] } },
    { label: "Services", Icon: Wrench, filter: { label: "Services", category: "Services & Trades" } },
    { label: "Food Trucks", Icon: Truck, nav: `/food-trucks/${activeCity}` },
    { label: "Restaurants", Icon: UtensilsCrossed, filter: { label: "Restaurants", category: "Restaurants" } },
    { label: "Thrift Sales", Icon: Tag, filter: { label: "Thrift Sales", type: "thrift" } },
    { label: "Livestock", Icon: ChickenIcon, filter: { label: "Livestock", type: "animals" } },
    { label: "Arts", Icon: Palette, filter: { label: "Arts", category: "Arts & Crafts" } },
    { label: "Auto", Icon: Car, filter: { label: "Auto", category: "Auto & Transportation" } },
    { label: "Beauty", Icon: Sparkles, filter: { label: "Beauty", category: "Health & Beauty" } },
    { label: "Childcare", Icon: Baby, filter: { label: "Childcare", category: "Childcare & Education" } },
    { label: "Clothing", Icon: Shirt, filter: { label: "Clothing", category: "Clothing & Accessories" } },
    { label: "Events", Icon: PartyPopper, filter: { label: "Events", category: "Events & Rentals" } },
    { label: "Food Products", Icon: HoneycombIcon, filter: { label: "Food Products", category: "Food Products" } },
    { label: "Housing", Icon: HomeIcon, filter: { label: "Housing", category: "Housing & Rentals" } },
    { label: "Pets", Icon: PawPrint, filter: { label: "Pets", category: "Pet Services" } },
    { label: "Products", Icon: Package, filter: { label: "Products", category: "Products", type: "product" } },
    { label: "Sports", Icon: FootballIcon, filter: { label: "Sports", category: "Sports & Outdoors" } },
    { label: "Yard", Icon: Sprout, filter: { label: "Yard", category: "Home & Garden", keywords: ["yard", "garden", "lawn", "outdoor", "patio", "plants", "landscaping", "mower"] } },
  ];

  const cityName = resolveCity(activeCity)?.label?.split(",")[0] ?? "your town";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {showTour && <ProductTour steps={TOUR_STEPS} onDone={() => setShowTour(false)} />}
      <main className="flex-1">
        {/* Category bubbles — one list on BOTH mobile and desktop. Signed-in
            users press & hold a category to pin it to the front (saved per-device). */}
        <CategoryBubbles
          items={CAT_NAV}
          activeLabel={activeCategory?.label ?? null}
          canReorder={!!user}
          onPick={(f) => pickCategory(f as CatFilter | null)}
          onNav={(href) => { if (gate(href)) return; router.push(href); }}
        />

        {/* Hero — desktop only; on mobile the search is in the top bar and the
            page opens straight into Featured Gems (below). */}
        <section className="relative overflow-hidden px-4 pb-12 pt-2 md:pt-10 md:bg-gradient-to-br md:from-green-50 md:via-white md:to-emerald-50">
          {/* soft glow accents */}
          <div className="hidden md:block pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-green-200/40 blur-3xl" />
          <div className="hidden md:block pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="hidden md:block relative max-w-3xl mx-auto text-center">
            {/* Hero tagline — plain text, not a button/link (per request) */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-sm leading-none">🏘️</span>
              <span className="text-xs font-semibold text-gray-600">Build, Shop, Connect, and Grow your Community — <span className="text-green-700">all in one place</span></span>
            </div>

            {/* Reserve two lines' height so the rotating word can't reflow the
                page (headline flipping 1↔2 lines was bouncing everything below,
                including the open city selector). */}
            <div className="mb-3 min-h-[4.2rem] sm:min-h-[6rem] flex items-center justify-center">
              <h1 className="text-3xl sm:text-[2.7rem] font-black text-gray-900 leading-[1.1] tracking-tight">
                Discover the best <TypedRotator phrases={HERO_PHRASES} className="text-green-600" /> in {cityName}.
              </h1>
            </div>
            {/* Search bar — query + location + submit on one line (desktop);
                stacks on mobile so the input keeps full width. */}
            <form onSubmit={handleSearch} data-tour="search" className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 border border-gray-100 p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "plumber", "fresh eggs"… or @ a person/business'
                  className="w-full px-4 py-3 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-100"
                />
                <AtMentionDropdown query={query} />
                <SearchPredictive query={query} onSearchAll={() => goSearch(query)} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="shrink-0 sm:border-l sm:border-gray-100 sm:pl-2">
                  <CitySelector
                    value={activeCity}
                    onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
                    radius={radius}
                    onRadiusChange={setRadius}
                  />
                </div>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none bg-green-600 text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 whitespace-nowrap"
                >
                  Go Local →
                </button>
              </div>
            </form>

            {/* Search suggestions — location-aware + learned */}
            <SearchSuggestions
              citySlug={activeCity}
              cityLabel={resolveCity(activeCity)?.label ?? cityName}
              onPick={(term) => { setQuery(term); goSearch(term); }}
              className="mb-3"
            />

            {/* Private-seller entry — anyone can sell, no business account needed */}
            <p className="text-center text-sm text-gray-600 mb-5">
              🏷️ Got something to sell?{" "}
              <Link href="/sell" className="text-green-700 font-semibold hover:underline">
                Sell an item — no business account needed →
              </Link>
            </p>

            {/* Friction-killer trust line */}
            <p className="text-xs text-gray-400 mb-5">100% FREE Until Launch! · No credit card needed · Now Live in Your Neighborhood</p>

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

          {/* Inline search / "view all" results — rendered in place of the home
              feed so the user never jumps to the old /search page. */}
          {inline && (
            <div className="max-w-5xl mx-auto mt-2 md:mt-6 px-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">{inline.title}</h2>
                <button onClick={clearInline} className="text-sm text-green-600 hover:underline shrink-0">✕ Clear</button>
              </div>
              {inlineLoading ? (
                <div className="text-center py-12"><span className="inline-block w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : inline.cards.length === 0 ? (
                <p className="text-center py-12 text-sm text-gray-500">No matches{inline.source === "q" ? " — try another search." : " here yet."}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {inline.cards.map((c) => (
                    <Link key={c.id} href={c.href} className="group" onClick={() => { try { sessionStorage.setItem("el_home_scroll", String(window.scrollY)); } catch { /* noop */ } }}>
                      <div className="w-full aspect-square rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden relative">
                        {c.vendorName && <span className="absolute top-2 left-2 z-10 max-w-[70%] truncate bg-white/95 backdrop-blur-sm text-gray-900 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.14)]">{c.vendorName}</span>}
                        {c.image
                          ? <img src={c.image} alt={c.title} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          : <span className="text-3xl text-gray-300">📦</span>}
                      </div>
                      <div className="pt-2 px-0.5">
                        <p className="text-xs font-semibold text-gray-900 line-clamp-1">{c.title}</p>
                        {c.subtitle && <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.subtitle}</p>}
                        {c.price != null
                          ? <p className="text-xs font-semibold text-gray-900 mt-0.5">${Number(c.price).toFixed(2)}</p>
                          : c.priceLabel && <p className="text-xs text-gray-500 mt-0.5">{c.priceLabel}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Featured Gems — boosted products first, blended with recent */}
          {!inline && recentListings.length > 0 && (
            <div className="max-w-5xl mx-auto mt-2 md:mt-14 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                  <span>{activeCategory ? activeCategory.label : "Featured Gems"} in</span>
                  <CitySelector
                    value={activeCity}
                    onChange={(slug, cityObj) => handleCityChange(slug, cityObj)}
                    radius={radius}
                    onRadiusChange={handleRadiusChange}
                  />
                </h2>
              </div>
              {displayedListings.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  No {activeCategory?.label.toLowerCase()} in {resolveCity(activeCity)?.label?.split(",")[0] ?? "your town"} yet.{" "}
                  <Link href={gemsViewAllHref()} className="text-green-600 font-semibold hover:underline">Browse all →</Link>
                </div>
              ) : (
              <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {displayedListings.map((l) => {
                  const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
                  const slug = vendor?.slug;
                  if (!slug) return null;
                  return (
                    <Link key={l.id} href={`/listings/${l.id}`} className="group" onClick={() => { try { sessionStorage.setItem("el_home_scroll", String(window.scrollY)); } catch { /* noop */ } }}>
                      <div className="w-full aspect-square rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden relative">
                        {l.boosted && <span className="absolute bottom-2 left-2 z-10 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">★ Featured</span>}
                        {vendor?.business_name && (
                          <span className="absolute top-2 left-2 z-10 max-w-[70%] truncate bg-white/95 backdrop-blur-sm text-gray-900 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.14)]">{vendor.business_name}</span>
                        )}
                        <GemHeart listingId={l.id} />
                        {l.images?.[0]
                          ? <img src={l.images[0]} alt={l.title} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          : <span className="text-3xl text-gray-300">{{ product:"📦", service:"🔧", restaurant:"🍽️", event:"🎉", rental:"🏠", thrift:"🏷️" }[l.type as string] ?? "📦"}</span>}
                      </div>
                      <div className="pt-2 px-0.5">
                        <p className="text-xs font-semibold text-gray-900 line-clamp-1">{l.title}</p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {vendor?.city ? `${vendor.city}, ${vendor.state}` : ""}{milesLabel(l.__dist) ? ` · ${milesLabel(l.__dist)}` : ""}
                        </p>
                        {l.price != null
                          ? <p className="text-xs font-semibold text-gray-900 mt-0.5">${Number(l.price).toFixed(2)}</p>
                          : l.price_label && <p className="text-xs text-gray-500 mt-0.5">{l.price_label}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-5 text-center">
                <button onClick={() => { if (gate("/?view=all")) return; runViewAll(); }} className="inline-block border border-green-300 text-green-700 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-green-50 transition-colors">View all →</button>
              </div>
              </>
              )}
            </div>
          )}

          {/* New businesses */}
          {!inline && newVendors.length > 0 && (
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
                    className={`relative bg-white rounded-2xl border p-3 flex flex-col items-center text-center hover:shadow-md transition-all ${v.boosted ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100 hover:border-green-200"}`}>
                    {v.boosted && <span className="absolute top-1.5 right-1.5 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">★</span>}
                    <VendorLogo src={v.logo_url} name={v.business_name} className="w-12 h-12 mb-2" fallbackTextClass="text-base" />
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">{v.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate w-full">{v.category}</p>
                    {v.rating > 0 && <p className="text-xs text-amber-500 font-medium mt-1">★ {Number(v.rating).toFixed(1)}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Map — local businesses near you */}
          {mapMarkers.length > 0 && (
            <div className="max-w-5xl mx-auto mt-4 px-4 pb-14">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">📍 Businesses near {cityName}</h2>
                <Link href={`/search${activeCity ? `?city=${activeCity}` : ""}`} onClick={(e) => { if (gate(`/search${activeCity ? `?city=${activeCity}` : ""}`)) e.preventDefault(); }} className="text-sm text-green-600 hover:underline">View all →</Link>
              </div>
              <LeafletMap markers={mapMarkers} height={420} />
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

        {/* The Local Referral Engine */}
        <section className="py-16 px-4 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-3">The Local Referral Engine</p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">Help a local friend. Get rewarded for it.</h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-4">
              Referring a trusted local business should do two things: help a neighbor <span className="text-gray-700 font-semibold">and</span> earn you something back.
              Most networking referrals get lost in the dust. Here, every referral is <span className="text-gray-700 font-semibold">tracked, encouraged, and rewarded</span> with 🪙 Local Bucks.
            </p>

            {/* The 3 legs */}
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-12 mb-6">The three legs of Everything Local</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
              {[
                { n: "1", icon: "🏘️", title: "Hyper-local & customer-obsessed", body: "Built for your town first — every business, listing, and referral lives right here in your community." },
                { n: "2", icon: "🤝", title: "A stronger, tighter-knit economy", body: "Neighbors referring neighbors keeps dollars local — building a more connected economy across the country." },
                { n: "3", icon: "💪", title: "Small business over everything", body: "Which should be enough on its own — putting small businesses and local economies ahead of anything else." },
              ].map((c) => (
                <div key={c.n} className="bg-green-50 border border-green-100 rounded-2xl p-5">
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1 leading-snug">{c.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
              <Link href="/signup" className="bg-green-600 text-white font-bold px-8 py-3.5 rounded-full hover:bg-green-700 transition-colors">
                Start referring &amp; earning →
              </Link>
              <Link href="/local-bucks" className="border-2 border-green-600 text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors">
                🪙 How Local Bucks work
              </Link>
            </div>
          </div>
        </section>


        {/* Local Loop + Local Jobs */}
        <section className="py-14 px-4 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-3xl mb-3">🏘️</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your town&apos;s Local Pages</h2>
            <p className="text-gray-500 text-base mb-6">
              Post to {resolveCity(activeCity)?.label ?? activeCity} Local Pages — ask for help, find a product, request a service, or browse local jobs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/community/${activeCity}`}
                onClick={(e) => { if (gate(`/community/${activeCity}`)) e.preventDefault(); }}
                className="inline-block bg-green-600 text-white font-bold px-8 py-3.5 rounded-full hover:bg-green-700 transition-colors"
              >
                🏘️ Open Local Pages →
              </Link>
              <Link
                href={`/jobs/${activeCity}`}
                onClick={(e) => { if (gate(`/jobs/${activeCity}`)) e.preventDefault(); }}
                className="inline-block bg-white border border-green-300 text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors"
              >
                💼 Browse Local Jobs/Gigs
              </Link>
              <Link
                href={`/explore/${activeCity}`}
                onClick={(e) => { if (gate(`/explore/${activeCity}`)) e.preventDefault(); }}
                className="inline-block bg-white border border-green-300 text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors"
              >
                🌿 Things To Do Near Me
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-3">Switch towns with the city selector above to browse other Local Pages</p>
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

        {/* From the blog */}
        {blogPosts.length > 0 && (
          <section className="py-16 px-4 bg-white border-t border-gray-100">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-1">From the blog</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Local news, tips &amp; highlights</h2>
                </div>
                <Link href="/blog" className="text-sm text-green-600 hover:underline font-semibold shrink-0">View all →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {blogPosts.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-green-200 transition-all">
                    <div className="h-40 bg-gray-100">
                      {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-5">
                      <span className="text-xs font-bold uppercase tracking-wide text-green-700">{({ news: "News", tips: "Tips", highlight: "Highlight", guide: "Guide", other: "Post" } as Record<string, string>)[p.category] ?? "Post"}</span>
                      <h3 className="font-bold text-gray-900 mt-1.5 mb-1 leading-snug group-hover:text-green-700 transition-colors line-clamp-2">{p.title}</h3>
                      {p.excerpt && <p className="text-sm text-gray-500 line-clamp-2">{p.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-100 py-12 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm text-gray-500 mb-10">
          <div>
            <p className="font-bold text-gray-900 mb-3">Explore</p>
            <ul className="space-y-2">
              <li><Link href="/search" className="hover:text-green-600">Browse All</Link></li>
              <li><Link href="/search?mode=listings&type=rental" className="hover:text-green-600">Rentals</Link></li>
              <li><Link href="/search?mode=listings&type=thrift" className="hover:text-green-600">Thrift Sales</Link></li>
              <li><Link href="/search?mode=listings&type=animals" className="hover:text-green-600">Animals &amp; Livestock</Link></li>
              <li><Link href="/search?mode=listings&category=Restaurants" className="hover:text-green-600">Restaurants</Link></li>
              <li><Link href="/search?mode=listings&category=Food+Products" className="hover:text-green-600">Food Products</Link></li>
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
              <li><Link href="/dashboard/vendor" className="hover:text-green-600">Business Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">Community</p>
            <ul className="space-y-2">
              <li><Link href={`/community/${activeCity}`} className="hover:text-green-600">Local Pages</Link></li>
              <li><Link href={`/jobs/${activeCity}`} className="hover:text-green-600">Jobs Board</Link></li>
              <li><Link href={`/explore/${activeCity}`} className="hover:text-green-600">Things To Do Near Me</Link></li>
              <li><Link href="/signup" className="hover:text-green-600">Join Free</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-gray-900 mb-3">Company</p>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-green-600">About</Link></li>
              <li><Link href="/blog" className="hover:text-green-600">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-green-600">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-green-600">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-green-600">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <Logo size="sm" />
          <span>© 2026 Everything Local · Made for local communities</span>
        </div>
      </footer>

      {/* Soft signup gate for guests (search / browse) */}
      <WelcomeGateModal open={autoGate || !!gateNext} required={autoGate} next={gateNext ?? undefined} onClose={() => setGateNext(null)} />

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

      {/* Persistent quick-add: list an item for sale (raised above the mobile bar) */}
      <QuickSellFab positionClass="bottom-24 lg:bottom-6 right-4 sm:right-6" />
    </div>
  );
}
