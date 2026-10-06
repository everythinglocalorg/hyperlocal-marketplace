"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFavorites } from "@/lib/favorites";
import { LISTING_CTAS } from "@/lib/cta";
import { fetchCityCenter, distanceMiles, LS_CITY_KEY } from "@/lib/cities";
import BuyNowModal from "@/components/BuyNowModal";
import MakeOfferModal from "@/components/MakeOfferModal";
import MessageModal from "@/components/MessageModal";
import PaymentOptions, { type PaymentHandles } from "@/components/PaymentOptions";
import { useCart } from "@/lib/cart";
import { consumeBackTo } from "@/lib/backNav";

type Vendor = {
  id: string;
  slug: string;
  business_name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  review_count: number | null;
  is_business: boolean | null;
  phone: string | null;
  menu_pdf_url: string | null;
  payment_handles: PaymentHandles | null;
  category: string | null;
  pickup_info: string | null;
  food_truck: unknown;
  stripe_connect_enabled: boolean | null;
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  price: number | null;
  price_label: string | null;
  condition: string | null;
  quantity: number | null;
  images: string[] | null;
  category: string | null;
  tags: string[] | null;
  cta_type: string | null;
  cta_url: string | null;
  sold_at: string | null;
  created_at: string | null;
};

type MoreItem = { id: string; title: string; price: number | null; price_label: string | null; images: string[] | null; type: string | null };

type Props = { listing: Listing; vendor: Vendor; currentUser: { id: string; full_name: string | null; email?: string } | null; more: MoreItem[] };

function priceText(price: number | null, label: string | null, type: string | null) {
  if (label) return label;
  if (price == null) return type === "service" ? "Request pricing" : "—";
  if (Number(price) === 0) return "Free";
  return `$${Number(price).toLocaleString()}`;
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export default function ProductPageClient({ listing, vendor, currentUser, more }: Props) {
  const router = useRouter();
  const favorites = useFavorites();
  const saved = favorites.isSaved(listing.id);

  const [modal, setModal] = useState<null | "buy" | "book" | "estimate" | "offer" | "message">(null);
  const [distanceMi, setDistanceMi] = useState<number | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [orderQty, setOrderQty] = useState(0);
  const [added, setAdded] = useState(false);
  const cart = useCart();

  const images = (listing.images ?? []).filter(Boolean);
  const isSold = !!listing.sold_at || listing.quantity === 0;
  const isPrivate = vendor.is_business === false;

  // Pickup ordering for "Order Now" items: add to cart, then complete the whole
  // order (one pickup ticket, pay in person).
  const isOrderItem = (listing.cta_type || "").toLowerCase() === "order" && listing.price != null && !isSold;
  const pickupLabel = vendor.pickup_info?.trim() || vendor.address?.trim()
    || [vendor.city, vendor.state].filter(Boolean).join(", ") || vendor.business_name;

  function addOrderToCart() {
    if (listing.price == null || orderQty < 1) return;
    cart.addItem(
      { id: vendor.id, name: vendor.business_name, slug: vendor.slug, pickupInfo: vendor.pickup_info, dropInfo: null },
      { listingId: listing.id, title: listing.title, price: Number(listing.price), image: images[0] ?? null, kind: "order", pickupInfo: vendor.pickup_info },
      orderQty,
    );
    setOrderQty(0);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  // Distance from the buyer's saved city to the seller.
  useEffect(() => {
    if (vendor.latitude == null || vendor.longitude == null) return;
    try {
      const raw = localStorage.getItem(LS_CITY_KEY);
      if (!raw) return;
      const city = JSON.parse(raw);
      if (!city?.slug) return;
      fetchCityCenter(city).then((c) => {
        if (c) setDistanceMi(distanceMiles(c.latitude, c.longitude, vendor.latitude!, vendor.longitude!));
      });
    } catch { /* no saved city */ }
  }, [vendor.latitude, vendor.longitude]);

  // Remember this listing's category so the home "Things you might like" feed can
  // adapt to what the visitor has recently viewed (most recent first, max 6).
  useEffect(() => {
    if (!listing.category) return;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("el_recent_cats") || "[]");
      const next = [listing.category, ...prev.filter((c) => c !== listing.category)].slice(0, 6);
      localStorage.setItem("el_recent_cats", JSON.stringify(next));
    } catch { /* noop */ }
  }, [listing.category]);

  // Primary CTA derived from the listing's own cta_type.
  const cta = (listing.cta_type || "").toLowerCase();
  const priceNum = listing.price;
  const primary = useMemo(() => {
    const label = (k: keyof typeof LISTING_CTAS, fallback: string) => LISTING_CTAS[k]?.label || fallback;
    switch (cta) {
      case "buy": return { label: label("buy", "Buy Now"), run: () => setModal("buy") };
      case "estimate": return { label: label("estimate", "Request Free Estimate"), run: () => setModal("estimate") };
      case "book": return { label: label("book", "Book Now"), run: () => setModal("book") };
      case "rent": return { label: label("rent", "Rent Now"), run: () => setModal("book") };
      case "call": return { label: label("call", "Call Now"), run: () => { if (vendor.phone) window.location.href = `tel:${vendor.phone}`; else setModal("message"); } };
      case "menu": return { label: label("menu", "See Menu"), run: () => { const u = vendor.menu_pdf_url || listing.cta_url; if (u) window.open(u, "_blank"); else setModal("message"); } };
      case "order": return { label: label("order", "Order Now"), run: () => { if (listing.cta_url) window.open(listing.cta_url, "_blank"); else setModal("buy"); } };
      case "apply": return { label: label("apply", "Apply Now"), run: () => { if (listing.cta_url) window.open(listing.cta_url, "_blank"); else setModal("message"); } };
      default:
        if (listing.type === "service") return { label: "Request Free Estimate", run: () => setModal("estimate") };
        return { label: "Buy Now", run: () => setModal("buy") };
    }
  }, [cta, listing.type, listing.cta_url, vendor.phone, vendor.menu_pdf_url]);

  // Offer only makes sense for a priced good sold by a private seller.
  const showOffer = isPrivate && priceNum != null && !["estimate", "call", "menu", "book", "rent", "apply"].includes(cta);

  // Plain "Buy" products add to the cart (which messages the seller to arrange
  // pickup & payment) — no inquiry record.
  const isBuyItem = !isOrderItem && !isSold && priceNum != null && (cta === "buy" || (!cta && listing.type !== "service"));
  function addBuyToCart() {
    if (priceNum == null) return;
    cart.addItem(
      { id: vendor.id, name: vendor.business_name, slug: vendor.slug, pickupInfo: vendor.pickup_info, dropInfo: null },
      { listingId: listing.id, title: listing.title, price: Number(priceNum), image: images[0] ?? null, kind: "buy", pickupInfo: vendor.pickup_info },
    );
    cart.open();
  }

  const stars = Math.round(vendor.rating ?? 0);
  const miles = distanceMi != null ? (distanceMi < 10 ? distanceMi.toFixed(1) : Math.round(distanceMi).toString()) : null;

  return (
    <div className="min-h-screen bg-white pb-40 md:pb-28">
      {/* Photo */}
      <div className="relative bg-gray-100">
        <div className="relative aspect-square w-full max-w-2xl mx-auto overflow-hidden">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[activeImg]} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">🛍️</div>
          )}

          {/* Back + Save float on the photo */}
          <button
            type="button"
            onClick={() => { const back = consumeBackTo(); if (back) { router.push(back); return; } if (window.history.length > 1) router.back(); else router.push("/discover"); }}
            aria-label="Back"
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow hover:bg-white"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={async () => { const r = await favorites.toggleWishlist(listing.id); if (r === "login") window.location.href = "/login"; }}
            aria-label={saved ? "Remove from Wish List" : "Save to Wish List"}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow hover:bg-white"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill={saved ? "#16a34a" : "none"} stroke={saved ? "#16a34a" : "currentColor"} strokeWidth={2}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>

          {isSold && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-gray-900 font-bold text-sm px-4 py-1.5 rounded-full">SOLD</span>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto px-3 py-2">
            {images.map((src, i) => (
              <button key={i} type="button" onClick={() => setActiveImg(i)} className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${i === activeImg ? "border-green-600" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Category + condition */}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          {listing.category && <span className="uppercase tracking-wide">{listing.category}</span>}
          {listing.category && listing.condition && <span>·</span>}
          {listing.condition && <span className="capitalize">{listing.condition}</span>}
        </div>

        <h1 className="mt-1 text-xl font-bold text-gray-900">{listing.title}</h1>
        <p className="mt-1 text-2xl font-extrabold text-gray-900">{priceText(priceNum, listing.price_label, listing.type)}</p>

        {listing.description && (
          <p className="mt-3 text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">
            {listing.description.split(/(\s+)/).map((tok, i) =>
              tok.startsWith("#") ? <span key={i} className="text-green-600 font-medium">{tok}</span> : tok
            )}
          </p>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {timeAgo(listing.created_at)}{listing.condition ? ` · ${listing.condition} condition` : ""}
        </p>

        {/* Seller card */}
        <div className="mt-5 rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <Link href={`/vendors/${vendor.slug}`} className="shrink-0">
            {vendor.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo_url} alt={vendor.business_name} className="w-12 h-12 rounded-full object-contain bg-white border border-gray-200" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                {(vendor.business_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/vendors/${vendor.slug}`} className="block font-semibold text-gray-900 truncate hover:underline">{vendor.business_name}</Link>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-amber-500">{"★".repeat(stars)}{"☆".repeat(Math.max(0, 5 - stars))}</span>
              {vendor.review_count ? <span>({vendor.review_count})</span> : <span>New</span>}
              {miles && <span>· {miles} mi away</span>}
              {isPrivate && <span>· Private seller</span>}
            </div>
          </div>
          <button type="button" onClick={() => setModal("message")} className="shrink-0 text-sm font-semibold text-green-700 border border-green-600 rounded-full px-4 py-1.5 hover:bg-green-50">
            Message
          </button>
        </div>

        {/* Visit shop */}
        <Link href={`/vendors/${vendor.slug}`} className="mt-3 flex items-center justify-between rounded-2xl bg-green-50 border border-green-100 px-4 py-3 hover:bg-green-100 transition-colors">
          <span className="text-sm font-semibold text-green-800">Visit {vendor.business_name}&rsquo;s local shop</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>

        <PaymentOptions handles={vendor.payment_handles} phone={vendor.phone} mode="info" className="mt-3" />

        {/* More local finds */}
        {more.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-900 mb-3">More from {vendor.business_name}</h2>
            <div className="grid grid-cols-2 gap-3">
              {more.map((m) => {
                const img = (m.images ?? [])[0];
                return (
                  <Link key={m.id} href={`/listings/${m.id}`} className="group">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🛍️</div>}
                    </div>
                    <p className="mt-1 text-xs font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500">{priceText(m.price, m.price_label, m.type)}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky action bar (sits above the mobile bottom nav) */}
      {!isSold && (
        isOrderItem ? (
          /* ── Premium pickup-order bar: pickup spot + cost + add to cart ── */
          <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-30 bg-white border-t border-gray-200 px-4 pt-2.5 pb-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between gap-2 text-xs mb-2">
                <span className="min-w-0 truncate text-gray-500">📍 Pickup · <span className="text-gray-800 font-medium">{pickupLabel}</span></span>
                <span className="shrink-0 font-semibold text-green-700">Pay in person</span>
              </div>
              {/* Quantity row — the total is shown on the cart / complete-order page */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="inline-flex items-center border border-gray-200 rounded-full">
                  <button type="button" onClick={() => setOrderQty((q) => Math.max(0, q - 1))} aria-label="Remove one" className="w-9 h-9 text-gray-600 hover:bg-gray-50 rounded-l-full text-xl leading-none disabled:opacity-30" disabled={orderQty === 0}>−</button>
                  <span className="w-10 text-center text-sm font-bold">{orderQty}</span>
                  <button type="button" onClick={() => setOrderQty((q) => q + 1)} aria-label="Add one" className="w-9 h-9 text-gray-600 hover:bg-gray-50 rounded-r-full text-xl leading-none">+</button>
                </div>
                <span className="text-sm text-gray-500">Qty to add</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={addOrderToCart} disabled={orderQty < 1} className="inline-flex items-center justify-center gap-1.5 text-sm font-bold rounded-full py-3 border-2 border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors">
                  {added ? "Added ✓" : "Add to cart"}
                </button>
                <button type="button" onClick={() => cart.open()} className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-green-600 rounded-full py-3 hover:bg-green-700 shadow-lg shadow-green-600/25">
                  Complete order{cart.count > 0 ? ` (${cart.count})` : ""}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-30 bg-white border-t border-gray-200 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <div className="shrink-0 mr-1">
                <p className="text-base font-extrabold text-gray-900 leading-none">{priceText(priceNum, listing.price_label, listing.type)}</p>
              </div>
              {showOffer && (
                <button type="button" onClick={() => setModal("offer")} className="flex-1 text-sm font-semibold text-gray-900 border border-gray-300 rounded-full py-2.5 hover:bg-gray-50">
                  Make offer
                </button>
              )}
              {isBuyItem ? (
                <button type="button" onClick={addBuyToCart} className="flex-1 text-sm font-bold text-white bg-green-600 rounded-full py-2.5 hover:bg-green-700">
                  Add to cart
                </button>
              ) : (
                <button type="button" onClick={primary.run} className="flex-1 text-sm font-bold text-white bg-green-600 rounded-full py-2.5 hover:bg-green-700">
                  {primary.label}
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* Modals */}
      {modal === "buy" && <BuyNowModal listing={listing} vendor={vendor} currentUser={currentUser} inquiryType="buy" onClose={() => setModal(null)} />}
      {modal === "book" && <BuyNowModal listing={listing} vendor={vendor} currentUser={currentUser} inquiryType="book" onClose={() => setModal(null)} />}
      {modal === "estimate" && <BuyNowModal listing={listing} vendor={vendor} currentUser={currentUser} inquiryType="estimate" onClose={() => setModal(null)} />}
      {modal === "offer" && <MakeOfferModal listing={listing} vendor={vendor} currentUser={currentUser} onClose={() => setModal(null)} />}
      {modal === "message" && <MessageModal listing={{ id: listing.id, title: listing.title }} vendor={vendor} currentUser={currentUser} onClose={() => setModal(null)} />}
    </div>
  );
}
