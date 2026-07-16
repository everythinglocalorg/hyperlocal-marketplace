"use client";

import { useState } from "react";
import Link from "next/link";
import LeafletMap, { type MapMarker } from "@/components/LeafletMap";
import BuyNowModal from "@/components/BuyNowModal";
import { formatPrice } from "@/lib/utils";

type Stop = {
  id: string; day: number; position: number; start_time: string | null; duration_min: number | null;
  title: string; notes: string | null; ref_type: string; ref_id: string | null;
  custom_address: string | null; custom_lat: number | null; custom_lng: number | null;
  href: string | null;
};
type Vendor = { id: string; business_name: string; slug: string; logo_url: string | null; city: string; state: string };
type Listing = { id: string; title: string; description: string | null; price: number | null; images: string[] | null; vendor: Vendor | Vendor[] };
type Meta = { theme: string[] | null; duration_label: string | null; best_for: string | null; est_cost_cents: number | null } | null;

function fmtTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ExperienceDetail({ listing, meta, stops, currentUser }: {
  listing: Listing; meta: Meta; stops: Stop[];
  currentUser: { id: string; full_name: string | null; email?: string } | null;
}) {
  const vendor = (Array.isArray(listing.vendor) ? listing.vendor[0] : listing.vendor) as Vendor;
  const [booking, setBooking] = useState(false);

  const days = Array.from(new Set(stops.map((s) => s.day))).sort((a, b) => a - b);
  const markers: MapMarker[] = stops
    .filter((s) => typeof s.custom_lat === "number" && typeof s.custom_lng === "number")
    .map((s) => ({ lat: s.custom_lat as number, lng: s.custom_lng as number, title: s.title, subtitle: fmtTime(s.start_time) ?? undefined, href: s.href ?? undefined }));

  const priceLabel = listing.price ? formatPrice(listing.price) : "Free";

  return (
    <main className="min-h-screen bg-white pb-24">
      {booking && (
        <BuyNowModal
          listing={{ id: listing.id, title: listing.title, price: listing.price, price_label: null }}
          vendor={{ id: vendor.id, business_name: vendor.business_name }}
          currentUser={currentUser}
          inquiryType="book"
          onClose={() => setBooking(false)}
        />
      )}

      {/* Hero */}
      <div className="relative h-56 sm:h-80 bg-gradient-to-br from-green-600 to-emerald-700 overflow-hidden">
        {listing.images?.[0] && <img src={listing.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <span className="absolute top-4 left-4 text-[11px] font-bold tracking-[0.2em] text-white/90 uppercase">🗺️ Local Experience</span>
        <div className="absolute inset-x-0 bottom-0 max-w-4xl mx-auto px-4 pb-5">
          <h1 className="font-serif text-2xl sm:text-4xl font-black text-white leading-tight">{listing.title}</h1>
          <p className="text-white/80 text-sm mt-1">{vendor.city}, {vendor.state}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600 pb-5 border-b border-gray-100">
          <Link href={`/vendors/${vendor.slug}`} className="inline-flex items-center gap-2 font-semibold text-green-700 hover:underline">
            <span className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
              {vendor.logo_url ? <img src={vendor.logo_url} alt="" className="w-full h-full object-contain" /> : "🏪"}
            </span>
            Curated by {vendor.business_name}
          </Link>
          {meta?.duration_label && <span>🕒 {meta.duration_label}</span>}
          {stops.length > 0 && <span>📍 {stops.length} stop{stops.length === 1 ? "" : "s"}</span>}
          <span className="font-bold text-green-700">{priceLabel}</span>
        </div>

        {(meta?.theme?.length || meta?.best_for) && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {(meta?.theme ?? []).map((t) => (
              <span key={t} className="text-xs font-semibold bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">{t}</span>
            ))}
            {meta?.best_for && <span className="text-xs text-gray-400">Best for: {meta.best_for}</span>}
          </div>
        )}

        {listing.description && (
          <p className="text-gray-600 leading-relaxed whitespace-pre-line mt-5">{listing.description}</p>
        )}

        {/* Route map */}
        {markers.length > 0 && (
          <div className="mt-7">
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-3">The Route</p>
            <LeafletMap markers={markers} numbered height={280} />
          </div>
        )}

        {/* Itinerary */}
        {days.length > 0 && (
          <div className="mt-8">
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">The Itinerary</p>
            {days.map((day) => {
              const dayStops = stops.filter((s) => s.day === day);
              return (
                <div key={day} className="mb-7">
                  {days.length > 1 && <h2 className="font-serif text-xl font-black text-gray-900 mb-3">Day {day}</h2>}
                  <ol className="space-y-3">
                    {dayStops.map((s) => {
                      const n = stops.findIndex((x) => x.id === s.id) + 1;
                      const inner = (
                        <>
                          <span className="shrink-0 w-7 h-7 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center mt-0.5">{n}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="font-bold text-gray-900">{s.title}</p>
                              {fmtTime(s.start_time) && <span className="text-xs text-gray-400">{fmtTime(s.start_time)}</span>}
                              {s.href && <span className="text-xs text-green-600 font-semibold">View →</span>}
                            </div>
                            {s.custom_address && <p className="text-xs text-gray-400 mt-0.5">📍 {s.custom_address}</p>}
                            {s.notes && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{s.notes}</p>}
                          </div>
                        </>
                      );
                      return (
                        <li key={s.id}>
                          {s.href ? (
                            <Link href={s.href} className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-4 hover:border-green-300 transition-colors">{inner}</Link>
                          ) : (
                            <div className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-4">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Book Now */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black text-gray-900 leading-none">{priceLabel}</p>
            {meta?.duration_label && <p className="text-xs text-gray-400 mt-0.5">{meta.duration_label}</p>}
          </div>
          <button
            onClick={() => setBooking(true)}
            className="ml-auto flex-1 sm:flex-none bg-green-600 text-white font-black px-8 py-3.5 rounded-2xl hover:bg-green-700 active:scale-[0.99] transition-all shadow-lg shadow-green-600/30"
          >
            Book Now →
          </button>
        </div>
      </div>
    </main>
  );
}
