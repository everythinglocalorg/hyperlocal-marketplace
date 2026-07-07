"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Plus, Search, Tent, Trees, Star, Compass, Truck } from "lucide-react";
import CitySelector from "@/components/CitySelector";
import { LS_CITY_KEY } from "@/lib/cities";
import { useRouter } from "next/navigation";
import type { Place, PlaceType } from "@/types";
import { PLACE_TYPES } from "@/types";

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  center: { latitude: number; longitude: number } | null;
  places: (Place & { distance_miles?: number })[];
  currentUserId: string | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  park:        <Trees className="w-4 h-4" />,
  campground:  <Tent className="w-4 h-4" />,
  attraction:  <Star className="w-4 h-4" />,
  thing_to_do: <Compass className="w-4 h-4" />,
  food_truck:  <Truck className="w-4 h-4" />,
};

export default function ExploreCityClient({
  citySlug, cityName, stateCode, places, currentUserId,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<PlaceType | "all">("all");

  function switchCity(slug: string) {
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    router.push(`/explore/${slug}`);
  }

  const filtered = useMemo(() => {
    return places.filter((p) => {
      const matchType = activeType === "all" || p.type === activeType;
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description?.toLowerCase().includes(query.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()));
      return matchType && matchQuery;
    });
  }, [places, query, activeType]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sub-header with city switcher */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <CitySelector value={citySlug} onChange={(slug) => switchCity(slug)} />
        </div>
      </div>

      {/* Board tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <div className="flex gap-2 mb-4">
          <Link href={`/community/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            🏘️ Local Pages
          </Link>
          <Link href={`/jobs/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            💼 Local Jobs
          </Link>
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white">
            🌿 Explore
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Explore {cityName}, {stateCode}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Parks, campgrounds, attractions &amp; things to do
              </p>
            </div>
            {currentUserId && (
              <Link
                href="/places/add"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add a place
              </Link>
            )}
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places, tags…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveType("all")}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                activeType === "all"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
              }`}
            >
              All
            </button>
            {PLACE_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveType(value)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeType === value
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                }`}
              >
                {TYPE_ICONS[value]}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Compass className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No places found</p>
            {currentUserId ? (
              <p className="text-sm mt-1">
                Be the first —{" "}
                <Link href="/places/add" className="text-emerald-600 underline">
                  add a place
                </Link>
              </p>
            ) : (
              <p className="text-sm mt-1">Sign in to add a place</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceCard({ place }: { place: Place & { distance_miles?: number } }) {
  const TYPE_LABELS: Record<string, string> = {
    park: "Park", campground: "Campground", attraction: "Attraction", thing_to_do: "Thing to Do", food_truck: "Food Truck",
  };

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Photo or placeholder */}
      <div className="relative w-full h-44 bg-emerald-50">
        {place.images[0] ? (
          <Image src={place.images[0]} alt={place.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Tent className="w-10 h-10 text-emerald-200" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-xs font-medium bg-white/90 text-emerald-700 px-2 py-0.5 rounded-full">
          {TYPE_LABELS[place.type] ?? place.type}
        </span>
        {place.fees === "free" && (
          <span className="absolute top-2 right-2 text-xs font-medium bg-emerald-600 text-white px-2 py-0.5 rounded-full">
            Free
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
          {place.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
          <MapPin className="w-3 h-3" />
          {place.city}, {place.state}
          {place.distance_miles != null && place.distance_miles > 0 && (
            <span className="ml-1">· {place.distance_miles.toFixed(1)} mi</span>
          )}
        </div>
        {place.description && (
          <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{place.description}</p>
        )}
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {place.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
