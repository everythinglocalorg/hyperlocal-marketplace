"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Plus, Search, Tent, Trees, Star, Compass, Truck, Map as MapIcon, Clock } from "lucide-react";
import CitySelector from "@/components/CitySelector";
import { LS_CITY_KEY } from "@/lib/cities";
import { useRouter } from "next/navigation";
import type { Place, PlaceType } from "@/types";
import { PLACE_TYPES } from "@/types";

export interface ExploreExperience {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  price: number | null;
  guide_name: string;
  guide_slug: string | null;
  city: string | null;
  state: string | null;
  duration_label: string | null;
  theme: string[];
  distance_miles: number | null;
}

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  center: { latitude: number; longitude: number } | null;
  places: (Place & { distance_miles?: number })[];
  experiences: ExploreExperience[];
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
  citySlug, cityName, stateCode, places, experiences, currentUserId,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<PlaceType | "all" | "experience">("all");

  function switchCity(slug: string) {
    if (typeof window !== "undefined") localStorage.setItem(LS_CITY_KEY, slug);
    router.push(`/explore/${slug}`);
  }

  const filteredExperiences = useMemo(() => {
    if (!query) return experiences;
    const q = query.toLowerCase();
    return experiences.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.guide_name.toLowerCase().includes(q) ||
        e.theme.some((t) => t.toLowerCase().includes(q))
    );
  }, [experiences, query]);

  const filtered = useMemo(() => {
    if (activeType === "experience") return [];
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
            🏘️ Local Loop
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
            {experiences.length > 0 && (
              <button
                onClick={() => setActiveType("experience")}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeType === "experience"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                }`}
              >
                <MapIcon className="w-4 h-4" />
                Experiences
              </button>
            )}
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

      {/* Experiences — curated itineraries you can book, sold by Local Guides */}
      {filteredExperiences.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          {activeType === "all" && (
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-emerald-600" />
                Local Experiences
              </h2>
              <span className="text-xs text-gray-400">Curated by Local Guides</span>
            </div>
          )}
          <div className={activeType === "all" ? "flex gap-4 overflow-x-auto pb-2 -mx-4 px-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
            {filteredExperiences.map((e) => (
              <ExperienceCard key={e.id} exp={e} rail={activeType === "all"} />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeType === "experience" ? (
          filteredExperiences.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MapIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">No Experiences match that search</p>
            </div>
          )
        ) : filtered.length === 0 ? (
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

function ExperienceCard({ exp, rail }: { exp: ExploreExperience; rail: boolean }) {
  return (
    <Link
      href={`/experiences/${exp.id}`}
      className={`group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow ${
        rail ? "flex-shrink-0 w-64" : ""
      }`}
    >
      <div className="relative w-full h-40 bg-emerald-50">
        {exp.images[0] ? (
          <Image src={exp.images[0]} alt={exp.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <MapIcon className="w-10 h-10 text-emerald-200" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-xs font-semibold bg-white/90 text-emerald-700 px-2 py-0.5 rounded-full">
          Experience
        </span>
        <span className="absolute top-2 right-2 text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
          {exp.price ? `$${exp.price}` : "Free"}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
          {exp.title}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">by {exp.guide_name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5">
          {exp.duration_label && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {exp.duration_label}
            </span>
          )}
          {exp.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {exp.city}
              {exp.distance_miles != null && exp.distance_miles > 0 && ` · ${exp.distance_miles.toFixed(1)} mi`}
            </span>
          )}
        </div>
        {exp.theme.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {exp.theme.slice(0, 3).map((t) => (
              <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
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
