"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Globe, Phone, DollarSign, Clock, Tag, Tent, ChevronLeft } from "lucide-react";
import type { Place } from "@/types";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  place: Place;
  creator: Profile | null;
  currentUserId: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  park: "Park",
  campground: "Campground",
  attraction: "Attraction",
  thing_to_do: "Thing to Do",
  food_truck: "Food Truck",
};

const FEES_LABELS: Record<string, string> = {
  free: "Free",
  "day-use": "Day-Use Fee",
  camping: "Camping Fee",
  varies: "Fees Vary",
};

export default function PlaceProfileClient({ place, creator, currentUserId }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const canEdit =
    currentUserId &&
    (currentUserId === place.created_by || currentUserId === place.claimed_by);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <Link
          href={`/explore/${place.city_slug}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Explore {place.city}, {place.state}
        </Link>
      </div>

      {/* Hero photo */}
      {place.images.length > 0 ? (
        <div className="max-w-4xl mx-auto px-4 mt-3">
          <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden bg-gray-200">
            <Image
              src={place.images[photoIndex]}
              alt={place.name}
              fill
              className="object-cover"
            />
            {place.images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {place.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 mt-3">
          <div className="w-full h-48 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Tent className="w-16 h-16 text-emerald-300" />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[place.type] ?? place.type}
                  {place.subtype ? ` · ${place.subtype}` : ""}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 mt-1">{place.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {place.city}, {place.state}
                </p>
              </div>
              {canEdit && (
                <Link
                  href={`/places/${place.slug}/edit`}
                  className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 whitespace-nowrap"
                >
                  Edit
                </Link>
              )}
            </div>
          </div>

          {/* Description */}
          {place.description && (
            <p className="text-gray-700 leading-relaxed">{place.description}</p>
          )}

          {/* Amenities */}
          {place.amenities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {place.amenities.map((a) => (
                  <span key={a} className="text-xs bg-white border border-gray-200 text-gray-700 rounded-full px-3 py-1">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {place.activities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Activities</h2>
              <div className="flex flex-wrap gap-2">
                {place.activities.map((a) => (
                  <span key={a} className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full px-3 py-1">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {place.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {place.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
                  <Tag className="w-3 h-3" />
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Additional photos grid */}
          {place.images.length > 1 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Photos</h2>
              <div className="grid grid-cols-3 gap-2">
                {place.images.map((src, i) => (
                  <button key={i} onClick={() => setPhotoIndex(i)} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <Image src={src} alt={`${place.name} photo ${i + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 text-sm">
            {place.address && (
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>{place.address}<br />{place.city}, {place.state} {place.zip}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-700">
              <DollarSign className="w-4 h-4 shrink-0 text-gray-400" />
              <span>
                {FEES_LABELS[place.fees] ?? place.fees}
                {place.fee_details ? ` — ${place.fee_details}` : ""}
              </span>
            </div>

            {place.hours && Object.keys(place.hours).length > 0 && (
              <div className="flex items-start gap-2 text-gray-700">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  {Object.entries(place.hours).map(([k, v]) => (
                    <div key={k}><span className="font-medium capitalize">{k}:</span> {v}</div>
                  ))}
                </div>
              </div>
            )}

            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-600 hover:underline"
              >
                <Globe className="w-4 h-4 shrink-0" />
                Website
              </a>
            )}

            {place.phone && (
              <a
                href={`tel:${place.phone}`}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                {place.phone}
              </a>
            )}
          </div>

          {/* Claim CTA — intentionally minor */}
          {!place.is_claimed && (
            <p className="text-xs text-center text-gray-400">
              Know this place?{" "}
              <Link href={`/claim/place/${place.slug}`} className="underline hover:text-gray-600">
                Claim it
              </Link>
            </p>
          )}

          {place.is_claimed && (
            <p className="text-xs text-center text-emerald-600 font-medium">✓ Claimed by owner</p>
          )}
        </div>
      </div>
    </div>
  );
}
