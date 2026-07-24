"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { LISTING_CTAS, ListingCtaType, ListingCtaAction, isListingCtaType, defaultCtaForListingType } from "@/lib/cta";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";

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
  cta_url?: string | null;
  porch_pickup?: boolean | null;
  local_drop?: boolean | null;
  pickup_info?: string | null;
  drop_info?: string | null;
  waiver_url?: string | null;
  waiver_filename?: string | null;
  sold_at?: string | null;
};

export const TYPE_ICON: Record<string, string> = { product: "📦", service: "🔧", restaurant: "🍽️", event: "🎉", rental: "🏠", thrift: "🏷️", housing_sale: "🏠", housing_rent: "🏡" };

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

// The public button mirrors the vendor's saved cta_type. When a listing has no
// saved choice (legacy/imported), it uses the SAME default the listing form
// shows for that type (defaultCtaForListingType), so the form dropdown and the
// public button always correlate. A choice that can't function — "Call Now"
// without a phone, or "View Menu" without a saved menu PDF — degrades sensibly.
export function resolveListingCta(listing: DetailListing, vendorPhone: string | null, menuPdfUrl: string | null): { ctaLabel: string; ctaAction: ListingCtaAction } {
  const saved = isListingCtaType(listing.cta_type) ? listing.cta_type : null;
  let cta: ListingCtaType = saved ?? defaultCtaForListingType(listing.type);
  if (cta === "call" && !vendorPhone) cta = "estimate";
  // "See Menu" never degrades to Call/Free Estimate — the click opens the menu
  // PDF when present, otherwise the vendor's storefront (handled by callers).
  return { ctaLabel: LISTING_CTAS[cta].label, ctaAction: LISTING_CTAS[cta].action };
}

/* ─── LISTING DETAIL POPUP ────────────────────────────────────────── */
// Bottom sheet on mobile, centered dialog on desktop. Shows the full photo
// gallery and details with a sticky action bar. Pass vendorName + vendorSlug
// (e.g. from search) to render a "view business" link; omit on the vendor's
// own profile page where it would be redundant.
export default function ListingDetailModal({ listing, vendorPhone, menuPdfUrl, vendorName, vendorSlug, cartVendor, paymentsEnabled, onClose, onBook, onBuy, onOrder, onMakeOffer, onMessage, onEstimate }: {
  listing: DetailListing; vendorPhone: string | null; menuPdfUrl: string | null;
  paymentsEnabled?: boolean;
  vendorName?: string | null; vendorSlug?: string | null;
  cartVendor?: { id: string; name: string; slug: string; pickupInfo?: string | null; dropInfo?: string | null };
  onClose: () => void; onBook: () => void; onBuy: () => void; onOrder?: () => void; onMakeOffer?: () => void; onMessage: () => void; onEstimate: () => void;
}) {
  const cart = useCart();
  const favorites = useFavorites();
  const saved = favorites.isSaved(listing.id);
  async function toggleSave() {
    const res = await favorites.toggleWishlist(listing.id);
    if (res === "login") window.location.href = "/login";
  }
  const [imgIdx, setImgIdx] = useState(0);
  const [shared, setShared] = useState(false);

  // Share the listing's own page — /listings/[id] carries og:image = the real
  // photo, so link previews show a clean image instead of a blank card.
  async function shareListing() {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/listings/${listing.id}`
      : `/listings/${listing.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: listing.title, url });
        return;
      } catch { /* cancelled — fall through to copy */ }
    }
    try { await navigator.clipboard?.writeText(url); } catch { /* ignore */ }
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  }
  const housingData = parseHousing(listing);
  const thriftData = parseThrift(listing);
  const priceLabel = derivePriceLabel(listing);
  const { ctaLabel, ctaAction } = resolveListingCta(listing, vendorPhone, menuPdfUrl);
  const images = listing.images ?? [];
  const visibleTags = (listing.tags ?? []).filter((t) => !t.startsWith("__"));
  const isThrift = listing.type === "thrift";
  const isSold = !!listing.sold_at || listing.quantity === 0;

  // Buy Now / Order Now: with no payments set up (no vendor Stripe), this is a
  // lead flow — so route it to the cart, exactly where Add to Cart goes. Once the
  // vendor can take card payments, it goes to the single-item buy instead.
  const canCartBuy = !!cartVendor && listing.price != null;
  function runBuy() {
    if (!paymentsEnabled && canCartBuy) addToCart();
    else onBuy();
  }

  function runCta() {
    if (ctaAction === "book") onBook();
    else if (ctaAction === "order") { if (!paymentsEnabled && canCartBuy) addToCart(); else (onOrder ?? onBuy)(); }
    else if (ctaAction === "buy") runBuy();
    else if (ctaAction === "apply") {
      // Opens the owner's external application link; falls back to Message if unset.
      if (listing.cta_url) window.open(listing.cta_url, "_blank", "noopener,noreferrer");
      else onMessage();
    }
    else if (ctaAction === "estimate") onEstimate();
    else if (ctaAction === "menu") {
      if (menuPdfUrl) window.open(menuPdfUrl, "_blank", "noopener,noreferrer");
      else if (vendorSlug) window.location.href = `/vendors/${vendorSlug}`;
      else onMessage();
    }
    else onMessage();
  }

  function addToCart() {
    if (!cartVendor || listing.price == null) return;
    const item = {
      listingId: listing.id, title: listing.title, price: Number(listing.price),
      image: listing.images?.[0] ?? null,
      porchPickup: !!listing.porch_pickup, localDrop: !!listing.local_drop,
      // Effective location: this listing's override, else the store default.
      pickupInfo: (listing.pickup_info?.trim() || cartVendor.pickupInfo) ?? null,
      dropInfo: (listing.drop_info?.trim() || cartVendor.dropInfo) ?? null,
    };
    const res = cart.addItem(cartVendor, item);
    if (res === "conflict") {
      const ok = window.confirm(`Your cart has items from ${cart.vendor?.name}. You can only order from one store at a time — start a new cart with ${cartVendor.name}?`);
      if (!ok) return;
      cart.startNewCart(cartVendor, item);
    }
    onClose();
    cart.open();
  }

  // One dominant, oversized primary CTA — the decision should be obvious at a glance.
  const primaryCta = "flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-black py-4 rounded-2xl text-base hover:bg-green-700 active:scale-[0.99] transition-all shadow-lg shadow-green-600/30";
  // Attach the price to buy/book actions so value + action land in one look.
  // A price is only shown when it's an actual amount (has a number). Descriptive
  // text like "See menu" / "Order now" / "Free estimate" just echoes the button,
  // so it's never rendered as a price line or appended to the CTA.
  const hasNumericPrice = !!priceLabel && /\d/.test(priceLabel);
  const isPurchase = ctaAction === "buy" || ctaAction === "order";
  const showPriceInCta = hasNumericPrice && (isPurchase || ctaAction === "book");
  // Show "Add to Cart" beside Buy/Order Now only for purchasable, priced items.
  const canAddToCart = isPurchase && !!cartVendor && listing.price != null && hasNumericPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gallery */}
        <div className="relative bg-white border-b border-gray-100 shrink-0">
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
          <button
            onClick={toggleSave}
            aria-label={saved ? "Remove from wish list" : "Save to wish list"}
            aria-pressed={saved}
            className="absolute top-3 right-14 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={saved ? "#22c55e" : "none"} stroke={saved ? "#22c55e" : "white"} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </button>
          <button
            onClick={shareListing}
            aria-label="Share this listing"
            className="absolute top-3 right-[6.25rem] w-9 h-9 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
          {shared && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-medium px-3 py-1.5 rounded-full pointer-events-none">
              Link copied ✓
            </div>
          )}
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
              <Link href={`/vendors/${vendorSlug}`} className="inline-flex items-center gap-1 mt-1.5 text-base font-bold text-green-700 hover:text-green-800 hover:underline transition-colors">
                🏪 {vendorName} · View business →
              </Link>
            )}
            {(hasNumericPrice || listing.condition) && (
              <p className="mt-1.5 text-lg font-black text-green-700">
                {hasNumericPrice && priceLabel}
                {listing.condition && <span className="text-gray-400 text-xs font-normal ml-2 capitalize">{listing.condition}</span>}
              </p>
            )}
            {/* Local fulfillment availability — the exact spot is revealed at checkout. */}
            {(listing.porch_pickup || listing.local_drop) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] font-semibold text-gray-500">Get it locally:</span>
                {listing.porch_pickup && (
                  <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">🏡 Porch Pickup</span>
                )}
                {listing.local_drop && (
                  <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">🚗 Local Drop</span>
                )}
              </div>
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

        {/* Sticky action bar — the conversion moment: one dominant CTA, message demoted */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-center gap-2 mb-2.5 text-[11px] font-medium text-gray-500">
            <span>📍 Locally owned</span>
            <span className="text-gray-300">·</span>
            <span>🪙 Earn Local Bucks</span>
          </div>
          <div className="flex items-stretch gap-2">
            <button
              onClick={onMessage}
              aria-label="Message the business"
              className="shrink-0 w-16 flex flex-col items-center justify-center gap-0.5 border border-gray-200 text-gray-600 rounded-2xl hover:border-gray-400 hover:text-gray-800 transition-colors"
            >
              <span className="text-lg leading-none">💬</span>
              <span className="text-[10px] font-medium">Message</span>
            </button>
            {isSold ? (
              <div className="flex-1 flex items-center justify-center gap-2 bg-gray-300 text-gray-600 font-black py-4 rounded-2xl text-base cursor-not-allowed select-none">
                ✓ Sold
              </div>
            ) : (
            <>
            {isThrift && onMakeOffer && (
              <button onClick={onMakeOffer} className="flex-1 flex items-center justify-center gap-1.5 border-2 border-green-600 text-green-700 font-black py-4 rounded-2xl text-base hover:bg-green-50 active:scale-[0.99] transition-all">
                💲 Make an Offer
              </button>
            )}
            {ctaAction === "call" && vendorPhone ? (
              <a href={`tel:${vendorPhone.replace(/[^\d+]/g, "")}`} className={primaryCta}>
                📞 {ctaLabel}
              </a>
            ) : ctaAction === "menu" ? (
              <a
                href={menuPdfUrl || (vendorSlug ? `/vendors/${vendorSlug}` : "#")}
                {...(menuPdfUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={primaryCta}
              >
                🍽️ {ctaLabel}
              </a>
            ) : canAddToCart ? (
              <>
                <button
                  onClick={addToCart}
                  className="flex-1 flex items-center justify-center gap-1.5 border-2 border-green-600 text-green-700 font-black py-4 rounded-2xl text-base hover:bg-green-50 active:scale-[0.99] transition-all"
                >
                  🛒 Add to Cart
                </button>
                <button onClick={runCta} className={primaryCta}>
                  <span>{ctaLabel}</span>
                  {showPriceInCta && <span className="font-bold opacity-90">· {priceLabel}</span>}
                  <span className="text-lg">→</span>
                </button>
              </>
            ) : (
              <button onClick={runCta} className={primaryCta}>
                <span>{ctaLabel}</span>
                {showPriceInCta && <span className="font-bold opacity-90">· {priceLabel}</span>}
                <span className="text-lg">→</span>
              </button>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
