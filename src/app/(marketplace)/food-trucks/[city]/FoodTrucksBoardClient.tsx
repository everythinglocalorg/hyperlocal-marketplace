"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck, Search, MapPin, Star, Phone } from "lucide-react";
import CitySelector from "@/components/CitySelector";
import BoardTabs from "@/components/BoardTabs";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";
import { LS_CITY_KEY } from "@/lib/cities";
import { normalizeFoodTruck, isLive } from "@/lib/foodtruck";

// Whether a truck is currently live (open / on the way).
function truckLive(t: { food_truck?: unknown }): boolean {
  return isLive(normalizeFoodTruck(t.food_truck));
}

export interface FoodTruck {
  id: string;
  business_name: string;
  slug: string;
  description: string | null;
  city: string;
  state: string;
  banner_url: string | null;
  logo_url: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  food_truck_featured: boolean;
  food_truck?: unknown;
  is_claimed: boolean;
  user_id: string | null;
  rating: number | null;
  review_count: number | null;
}

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  trucks: FoodTruck[];
  currentUserId: string | null;
}

export default function FoodTrucksBoardClient({
  citySlug, cityName, stateCode, trucks, currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [payToast, setPayToast] = useState<"featured" | "cancelled" | null>(null);

  // Return trip from Stripe Checkout.
  useEffect(() => {
    if (searchParams.get("featured")) setPayToast("featured");
    else if (searchParams.get("feature_cancelled")) setPayToast("cancelled");
  }, [searchParams]);

  function switchCity(slug: string) {
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    router.push(`/food-trucks/${slug}`);
  }

  const filtered = useMemo(() => {
    if (!query) return trucks;
    const q = query.toLowerCase();
    return trucks.filter(
      (t) => t.business_name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    );
  }, [trucks, query]);

  const byLiveFirst = (a: FoodTruck, b: FoodTruck) => Number(truckLive(b)) - Number(truckLive(a));
  const featured = filtered.filter((t) => t.food_truck_featured).sort(byLiveFirst);
  const rest = filtered.filter((t) => !t.food_truck_featured).sort(byLiveFirst);

  const markers: MapMarker[] = filtered
    .filter((t) => typeof t.latitude === "number" && typeof t.longitude === "number")
    .map((t) => ({
      lat: t.latitude as number,
      lng: t.longitude as number,
      title: t.business_name,
      href: `/vendors/${t.slug}`,
    }));

  // Trucks this signed-in user owns and could feature.
  const mine = trucks.filter((t) => currentUserId && t.user_id === currentUserId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sub-header with city switcher */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <CitySelector value={citySlug} onChange={(slug) => switchCity(slug)} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        <BoardTabs citySlug={citySlug} active="food-trucks" />
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Food Trucks in {cityName}, {stateCode}
              </h1>
            </div>
            {markers.length > 0 && (
              <button
                onClick={() => setShowMap((v) => !v)}
                className="text-sm border-2 border-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl hover:border-gray-400 transition-colors whitespace-nowrap"
              >
                {showMap ? "Hide map" : "🗺️ Map"}
              </button>
            )}
          </div>

          {payToast === "featured" && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
              <span className="text-lg">✅</span>
              <p className="text-sm text-green-800">
                <strong>Payment received — you&apos;re featured!</strong> Your truck moves to the top of this board within a few seconds; refresh if you don&apos;t see it yet.
              </p>
              <button onClick={() => setPayToast(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
            </div>
          )}
          {payToast === "cancelled" && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-600">Checkout cancelled — nothing was charged.</p>
              <button onClick={() => setPayToast(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trucks, food, cuisine…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Feature CTA — only for someone who actually owns a truck here */}
          {mine.length > 0 && mine.some((t) => !t.food_truck_featured) && (
            <FeatureBar trucks={mine.filter((t) => !t.food_truck_featured)} />
          )}
        </div>
      </div>

      {showMap && markers.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-5">
          <LeafletMap markers={markers} height={300} />
        </div>
      )}

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No food trucks in {cityName} yet</p>
            <p className="text-sm mt-1">
              Run one?{" "}
              <Link href="/onboarding/vendor" className="text-orange-600 underline">
                Add your truck free
              </Link>
            </p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <>
                <h2 className="text-xs font-bold tracking-widest text-orange-600 uppercase mb-3">★ Featured</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {featured.map((t) => <TruckCard key={t.id} truck={t} />)}
                </div>
              </>
            )}
            {rest.length > 0 && (
              <>
                {featured.length > 0 && (
                  <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">All trucks</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rest.map((t) => <TruckCard key={t.id} truck={t} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Inline "get featured" bar — mirrors the Local Jobs $5/mo flow. */
function FeatureBar({ trucks }: { trucks: FoodTruck[] }) {
  const [busy, setBusy] = useState(false);
  const [vendorId, setVendorId] = useState(trucks[0]?.id ?? "");

  async function feature() {
    setBusy(true);
    const res = await fetch("/api/food-trucks/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setBusy(false);
      alert(data.error ?? "Couldn't start checkout.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-orange-50 border border-orange-200 px-4 py-3">
      <span className="text-lg">★</span>
      <p className="text-sm text-orange-900 min-w-0">
        <strong>Get to the top of this board.</strong> $5/month — same as a job post.
      </p>
      {trucks.length > 1 && (
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="text-sm border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.business_name}</option>)}
        </select>
      )}
      <button
        onClick={feature}
        disabled={busy || !vendorId}
        className="ml-auto bg-orange-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {busy ? "Starting…" : "Feature my truck"}
      </button>
    </div>
  );
}

function TruckCard({ truck }: { truck: FoodTruck }) {
  const photo = truck.banner_url ?? truck.logo_url;
  const ft = normalizeFoodTruck(truck.food_truck);
  const live = isLive(ft);
  return (
    <Link
      href={`/vendors/${truck.slug}`}
      className={`group bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${
        truck.food_truck_featured ? "border-orange-200 ring-1 ring-orange-100" : "border-gray-100"
      }`}
    >
      <div className="relative w-full h-44 bg-orange-50">
        {photo ? (
          <Image src={photo} alt={truck.business_name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Truck className="w-10 h-10 text-orange-200" />
          </div>
        )}
        {truck.food_truck_featured && (
          <span className="absolute top-2 left-2 text-xs font-bold bg-orange-600 text-white px-2 py-0.5 rounded-full">
            ★ Featured
          </span>
        )}
        {!truck.is_claimed && (
          <span className="absolute top-2 right-2 text-xs font-medium bg-white/90 text-gray-500 px-2 py-0.5 rounded-full">
            Unclaimed
          </span>
        )}
        {live && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 text-xs font-bold bg-green-600 text-white px-2.5 py-1 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" /> {ft.status === "open" ? "Open now" : "On the way"}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors line-clamp-1">
          {truck.business_name}
        </h3>
        {live && ft.spot.name && (
          <p className="text-xs text-green-700 font-medium mt-0.5 line-clamp-1">📍 {ft.spot.name}{ft.spot.until ? ` · until ${ft.spot.until}` : ""}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {truck.city}, {truck.state}
          </span>
          {!!truck.review_count && (
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {Number(truck.rating ?? 0).toFixed(1)} ({truck.review_count})
            </span>
          )}
          {truck.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />
              Call
            </span>
          )}
        </div>
        {truck.description && (
          <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{truck.description}</p>
        )}
      </div>
    </Link>
  );
}
