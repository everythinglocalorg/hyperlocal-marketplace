"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { LISTING_CTAS, ListingCtaAction, isListingCtaType } from "@/lib/cta";

// Minimal listing shape the detail popup (and its CTA resolution) needs.
// Both the vendor profile and search results satisfy this structurally.
export type DetailListing = {
  id: string;
  title: string;
  type: string;
  category: string;
  price: number | null;
  price_label: string | null;
  images: string[];
  tags: string[] | null;
  description?: string | null;
  condition?: string | null;
  quantity?: number | null;
  is_featured?: boolean;
  cta_type?: string | null;
  waiver_url?: string | null;
  waiver_filename?: string | null;
};

export const TYPE_ICON: Record<string, string> = { product: "📦", service: "🔧", restaurant: "🍽️", event: "🎉", rental: "🏠", thrift: "🏷️", housing_sale: "🏠", housing_rent: "🏡" };

const BUY_NOW_CATEGORIES = [
  "Products", "Clothing & Accessories", "Auto & Transportation",
  "Health & Wellness", "Arts & Crafts", "Home & Garden",
  "Sports & Outdoors", "Childcare & Education",
];

export function parseHousing(listing: DetailListing): any | null {
  if (listing.type !== "housing_sale" && listing.type !== "housing_rent") return null;
  try { const t = listing.tags?.find((t) => t.startsWith("__housing:")); return t ? JSON.parse(t.replace("__housing:", "")) : null; } catch { return null; }
}

export function parseThrift(listing: DetailListing): { address: string | null; openDays: { day: string; open: string; close: string }[] } | null {
  if (listing.type !== "thrift") return null;
  try {
    const t = listing.tags?.find((t) => t.startsWith("__hours:")); let hours: any[] = [];
    if (t) hours = JSON.parse(t.replace("__hours:", ""));
    return { address: listing.price_label, openDays: hours.filter((h) => !h.closed && h.open && h.close) };
  } catch { return null; }
}

export function derivePriceLabel(listing: DetailListing): string | null {
  if (listing.type === "housing_sale" || listing.type === "housing_rent") {
    return listing.price ? `${formatPrice(listing.price)}${listing.type === "housing_rent" ? "/mo" : ""}` : listing.price_label ?? null;
  }
  if (listing.type === "thrift") return null;
  return listing.price !== null ? formatPrice(listing.price) : listing.price_label ?? null;
}

// CTA — driven by the listing's saved cta_type (shared LISTING_CTAS map),
// falling back to the legacy type/category-based default for listings saved
// before cta_type existed. A saved "call" without a phone or "menu" without a
// saved menu PDF also falls back.
export function resolveListingCta(listing: DetailListing, vendorPhone: string | null, menuPdfUrl: string | null): { ctaLabel: string; ctaAction: ListingCtaAction | "message" } {
  const savedCta = isListingCtaType(listing.cta_type) ? listing.cta_type : null;
  if (savedCta && !(savedCta === "call" && !vendorPhone) && !(savedCta === "menu" && !menuPdfUrl)) {
    return { ctaLabel: LISTING_CTAS[savedCta].label, ctaAction: LISTING_CTAS[savedCta].action };
  }
  if (listing.type === "rental") return { ctaLabel: "Book Now", ctaAction: "book" };
  if (BUY_NOW_CATEGORIES.some((c) => listing.category?.includes(c.split(" ")[0]))) return { ctaLabel: "Buy Now", ctaAction: "buy" };
  if (vendorPhone) return { ctaLabel: "Call Now", ctaAction: "call" };
  return { ctaLabel: "Message", ctaAction: "message" };
}

/* ─── LISTING DETAIL POPUP ────────────────────────────────────────── */
// Bottom sheet on mobile, centered dialog on desktop. Shows the full photo
// gallery and details with a sticky action bar. Pass vendorName + vendorSlug
// (e.g. from search) to render a "view business" link; omit on the vendor's
// own profile page where it would be redundant.
export default function ListingDetailModal({ listing, vendorPhone, menuPdfUrl, vendorName, vendorSlug, onClose, onBook, onBuy, onMessage }: {
  listing: DetailListing; vendorPhone: string | null; menuPdfUrl: string | null;
  vendorName?: string | null; vendorSlug?: string | null;
  onClose: () => void; onBook: () => void; onBuy: () => void; onMessage: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const housingData = parseHousing(listing);
  const thriftData = parseThrift(listing);
  const priceLabel = derivePriceLabel(listing);
  const { ctaLabel, ctaAction } = resolveListingCta(listing, vendorPhone, menuPdfUrl);
  const images = listing.images ?? [];
  const visibleTags = (listing.tags ?? []).filter((t) => !t.startsWith("__"));

  function runCta() {
    if (ctaAction === "book") onBook();
    else if (ctaAction === "buy") onBuy();
    else if (ctaAction === "menu" && menuPdfUrl) window.open(menuPdfUrl, "_blank", "noopener,noreferrer");
    else onMessage();
  }

  const ctaClasses = "flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-green-700 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gallery */}
        <div className="relative bg-gray-900 shrink-0">
          {images.length > 0 ? (
            <img src={images[imgIdx]} alt={listing.title} className="w-full h-56 sm:h-72 object-cover" />
          ) : (
            <div className="w-full h-40 flex items-center justify-center text-6xl">{TYPE_ICON[listing.type] ?? "📦"}</div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white text-lg leading-none flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            ×
          </button>
          {listing.is_featured && (
            <span className="absolute top-3 left-3 bg-amber-400 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full">⭐ Featured</span>
          )}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                ‹
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} aria-label={`Photo ${i + 1}`} className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold tracking-wider text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full uppercase">
                {TYPE_ICON[listing.type] ?? "📦"} {listing.category ?? listing.type.replace(/_/g, " ")}
              </span>
              {listing.quantity === 0 && (
                <span className="bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-full">Out of Stock</span>
              )}
            </div>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{listing.title}</h3>
            {vendorName && vendorSlug && (
              <Link href={`/vendors/${vendorSlug}`} className="inline-block mt-1 text-xs font-medium text-gray-500 hover:text-green-700 transition-colors">
                🏪 {vendorName} · View business →
              </Link>
            )}
            {(priceLabel || listing.condition) && (
              <p className="mt-1.5 text-lg font-black text-green-700">
                {priceLabel}
                {listing.condition && <span className="text-gray-400 text-xs font-normal ml-2 capitalize">{listing.condition}</span>}
              </p>
            )}
          </div>

          {listing.description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
          )}

          {/* Housing details */}
          {housingData && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Bedrooms", housingData.bedrooms], ["Bathrooms", housingData.bathrooms],
                ["Sq Ft", housingData.sqft], ["Lot Size", housingData.lot_size],
                ["Year Built", housingData.year_built],
                ["Available", housingData.available_date],
                ["Lease", listing.type === "housing_rent" ? housingData.lease_term : null],
              ].filter(([, v]) => v).map(([label, v]) => (
                <div key={label as string} className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-semibold text-gray-800">{v as string}</p>
                </div>
              ))}
              {[housingData.garage && "🚗 Garage", housingData.pets_allowed && "🐾 Pets Allowed", housingData.furnished && "🛋️ Furnished"].filter(Boolean).length > 0 && (
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {[housingData.garage && "🚗 Garage", housingData.pets_allowed && "🐾 Pets Allowed", housingData.furnished && "🛋️ Furnished"].filter(Boolean).map((f) => (
                    <span key={f as string} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thrift sale location + hours */}
          {thriftData && (
            <div className="text-sm space-y-2">
              {thriftData.address && (
                <p className="text-gray-700"><span className="font-semibold">📍 Location:</span> {thriftData.address}</p>
              )}
              {thriftData.openDays.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-1">
                  {thriftData.openDays.map((h) => (
                    <p key={h.day} className="text-gray-600 text-xs"><span className="font-semibold w-24 inline-block">{h.day}</span> {h.open}–{h.close}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stock + tags */}
          {typeof listing.quantity === "number" && listing.quantity > 0 && (
            <p className="text-xs text-gray-400">{listing.quantity} in stock</p>
          )}
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleTags.map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4 flex gap-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {ctaAction !== "message" && (
            <button
              onClick={onMessage}
              className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl text-sm hover:border-gray-400 transition-colors"
            >
              💬 Message
            </button>
          )}
          {ctaAction === "call" && vendorPhone ? (
            <a href={`tel:${vendorPhone.replace(/[^\d+]/g, "")}`} className={ctaClasses}>
              📞 {ctaLabel}
            </a>
          ) : ctaAction === "menu" && menuPdfUrl ? (
            <a href={menuPdfUrl} target="_blank" rel="noopener noreferrer" className={ctaClasses}>
              🍽️ {ctaLabel}
            </a>
          ) : (
            <button onClick={runCta} className={ctaClasses}>
              {ctaLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
