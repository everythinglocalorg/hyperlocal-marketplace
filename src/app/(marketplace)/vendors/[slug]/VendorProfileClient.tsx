"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import RentalBookingModal from "@/components/rental/RentalBookingModal";
import BuyNowModal from "@/components/BuyNowModal";
import MessageModal from "@/components/MessageModal";

const BUY_NOW_CATEGORIES = [
  "Products", "Clothing & Accessories", "Auto & Transportation",
  "Health & Wellness", "Arts & Crafts", "Home & Garden",
  "Sports & Outdoors", "Childcare & Education",
];

type PageBlock = {
  id: string;
  image_url: string;
  text: string;
  font_size: "sm" | "base" | "lg" | "xl" | "2xl";
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  layout: "image-left" | "image-right" | "image-top" | "image-only";
};

type Vendor = {
  id: string; business_name: string; slug: string; description: string | null;
  category: string; city: string; state: string; zip_code: string;
  address: string | null; phone: string | null; website: string | null;
  logo_url: string | null; banner_url: string | null; tier: string;
  is_verified: boolean; rating: number; review_count: number;
  local_bucks_earned: number; service_radius_miles: number;
  page_blocks?: PageBlock[] | null;
  menu_pdf_url?: string | null;
  cta_button?: { enabled?: boolean; label?: string; link_type?: string; url?: string; custom_question?: string } | null;
};

type Listing = {
  id: string; title: string; description: string | null; type: string;
  price: number | null; price_label: string | null; condition: string | null;
  quantity: number | null; images: string[]; category: string;
  tags: string[] | null; is_featured: boolean; view_count: number;
  waiver_url: string | null; waiver_filename: string | null;
};

type Review = {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

interface Props {
  vendor: Vendor; listings: Listing[]; reviews: Review[];
  currentUserId: string | null; currentUserReferralCode: string | null; inboundRefCode: string | null;
}

export default function VendorProfileClient({ vendor, listings, reviews, currentUserId, currentUserReferralCode, inboundRefCode }: Props) {
  const supabase = createClient();
  const [activeSection, setActiveSection] = useState<"services" | "reviews" | "about">("services");
  const [copied, setCopied] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [bookingDurations, setBookingDurations] = useState<any[]>([]);
  const [buyListing, setBuyListing] = useState<Listing | null>(null);
  const [messageListing, setMessageListing] = useState<Listing | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null; email?: string } | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showCtaForm, setShowCtaForm] = useState(false);
  const [ctaFormName, setCtaFormName] = useState("");
  const [ctaFormEmail, setCtaFormEmail] = useState("");
  const [ctaFormPhone, setCtaFormPhone] = useState("");
  const [ctaFormMessage, setCtaFormMessage] = useState("");
  const [ctaFormCustom, setCtaFormCustom] = useState("");
  const [ctaFormSubmitting, setCtaFormSubmitting] = useState(false);
  const [ctaFormDone, setCtaFormDone] = useState(false);

  const ctaBtn = vendor.cta_button as { enabled?: boolean; label?: string; link_type?: string; url?: string; custom_question?: string } | null;

  async function submitCtaForm(e: React.FormEvent) {
    e.preventDefault();
    setCtaFormSubmitting(true);
    const supabase = createClient();
    await supabase.from("purchase_inquiries").insert({
      vendor_id: vendor.id,
      buyer_id: currentUser?.id ?? null,
      buyer_name: ctaFormName,
      buyer_email: ctaFormEmail,
      buyer_phone: ctaFormPhone || null,
      message: [ctaFormMessage, ctaBtn?.custom_question && ctaFormCustom ? `${ctaBtn.custom_question}: ${ctaFormCustom}` : ""].filter(Boolean).join("\n\n"),
      inquiry_type: "cta",
    });
    setCtaFormSubmitting(false); setCtaFormDone(true);
  }

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await createClient().from("profiles").select("id, full_name").eq("id", user.id).single();
      if (profile) setCurrentUser({ ...profile, email: user.email });
    });
  }, []);

  // Track a store-page view once per browser session (counts as a view for each listing).
  useEffect(() => {
    const key = `viewed_vendor_${vendor.id}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_vendor_listing_views", { vendor_id_in: vendor.id }).then(() => {});
    supabase.rpc("increment_vendor_profile_views", { vendor_id_in: vendor.id }).then(() => {});
  }, [supabase, vendor.id]);

  // Bump a listing's click count when a visitor acts on it (buy/book/message).
  function trackClick(listingId: string) {
    supabase.rpc("increment_listing_clicks", { listing_id_in: listingId }).then(() => {});
  }

  async function openBooking(listing: Listing) {
    trackClick(listing.id);
    const { data: durations } = await supabase.from("rental_durations").select("*").eq("listing_id", listing.id).order("hours");
    setBookingDurations(durations ?? []);
    setBookingListing(listing);
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink = currentUserReferralCode
    ? `${appUrl}/vendors/${vendor.slug}?ref=${currentUserReferralCode}`
    : `${appUrl}/vendors/${vendor.slug}`;

  function copyShareLink() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submitReview() {
    if (!currentUserId) return;
    setSubmittingReview(true);
    setReviewError(null);
    const { error } = await supabase.from("reviews").insert({
      vendor_id: vendor.id, reviewer_id: currentUserId,
      rating: reviewRating, comment: reviewComment || null,
    });
    if (error) {
      setReviewError(error.message.includes("unique") ? "You've already reviewed this vendor." : error.message);
    } else {
      try {
        await supabase.rpc("award_local_bucks", { p_user_id: currentUserId, p_amount: 5, p_reason: "leave_review", p_reference_id: vendor.id, p_reference_type: "vendor" });
      } catch {}
      setLocalReviews((prev) => [{ id: Date.now().toString(), rating: reviewRating, comment: reviewComment || null, created_at: new Date().toISOString(), reviewer: { full_name: "You", avatar_url: null } }, ...prev]);
      setReviewSuccess(true); setShowReviewForm(false); setReviewComment(""); setReviewRating(5);
    }
    setSubmittingReview(false);
  }

  const stars = (rating: number, size = "text-sm") =>
    Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={`${size} ${i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}>★</span>
    ));

  const featuredListings = listings.filter((l) => l.is_featured);
  const regularListings = listings.filter((l) => !l.is_featured);
  const orderedListings = [...featuredListings, ...regularListings];
  const pageBlocks: PageBlock[] = (vendor.page_blocks as PageBlock[]) ?? [];

  const FONT_SIZE_MAP: Record<string, string> = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" };

  const renderPhotoBlocks = () => (
    <div>
      {pageBlocks.map((block) => {
        const textClass = [
          FONT_SIZE_MAP[block.font_size] ?? "text-base",
          block.bold ? "font-bold" : "font-normal",
          block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left",
        ].join(" ");

        if (block.layout === "image-only") {
          return (
            <div key={block.id} className="w-full mb-6">
              <img src={block.image_url} alt="" className="w-full max-h-[500px] object-cover rounded-2xl" />
              {block.text && <p className={`mt-4 ${textClass}`} style={{ color: block.color }}>{block.text}</p>}
            </div>
          );
        }

        if (block.layout === "image-top") {
          return (
            <div key={block.id} className="py-6">
              <img src={block.image_url} alt="" className="w-full rounded-2xl max-h-96 object-cover mb-5" />
              {block.text && <p className={textClass} style={{ color: block.color }}>{block.text}</p>}
            </div>
          );
        }

        const isLeft = block.layout === "image-left";
        return (
          <div key={block.id} className={`py-8 flex flex-col ${isLeft ? "sm:flex-row" : "sm:flex-row-reverse"} gap-6 sm:gap-10 items-center`}>
            <div className="w-full sm:w-1/2 shrink-0">
              <img src={block.image_url} alt="" className="w-full rounded-2xl object-cover max-h-80 sm:max-h-96" />
            </div>
            {block.text && (
              <div className="flex-1">
                <p className={textClass} style={{ color: block.color }}>{block.text}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (<>
    {/* Modals */}
    {messageListing && <MessageModal listing={{ id: messageListing.id, title: messageListing.title }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} onClose={() => setMessageListing(null)} />}
    {showMessageModal && <MessageModal listing={{ id: vendor.id, title: `Contact ${vendor.business_name}` }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} onClose={() => setShowMessageModal(false)} />}

    {/* CTA built-in form modal */}
    {showCtaForm && ctaBtn?.link_type === "form" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCtaForm(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          {ctaFormDone ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✅</p>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Sent!</h3>
              <p className="text-sm text-gray-500 mb-4">{vendor.business_name} will be in touch soon.</p>
              <button onClick={() => { setShowCtaForm(false); setCtaFormDone(false); }} className="text-sm text-green-600 hover:underline">Close</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{ctaBtn.label || "Contact Us"}</h3>
                <button onClick={() => setShowCtaForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <form onSubmit={submitCtaForm} className="space-y-3">
                <input required value={ctaFormName} onChange={(e) => setCtaFormName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input required type="email" value={ctaFormEmail} onChange={(e) => setCtaFormEmail(e.target.value)} placeholder="Email address" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={ctaFormPhone} onChange={(e) => setCtaFormPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {ctaBtn.custom_question && (
                  <input required value={ctaFormCustom} onChange={(e) => setCtaFormCustom(e.target.value)} placeholder={ctaBtn.custom_question} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                )}
                <textarea required value={ctaFormMessage} onChange={(e) => setCtaFormMessage(e.target.value)} rows={3} placeholder="Message" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                <button type="submit" disabled={ctaFormSubmitting} className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
                  {ctaFormSubmitting ? "Sending…" : "Send →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    )}
    {buyListing && <BuyNowModal listing={{ id: buyListing.id, title: buyListing.title, price: buyListing.price, price_label: buyListing.price_label }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} inquiryType="buy" onClose={() => setBuyListing(null)} />}
    {bookingListing && <RentalBookingModal listing={{ id: bookingListing.id, title: bookingListing.title, waiver_url: bookingListing.waiver_url, waiver_filename: bookingListing.waiver_filename }} vendor={{ id: vendor.id, business_name: vendor.business_name }} durations={bookingDurations} currentUser={currentUser} onClose={() => setBookingListing(null)} />}

    <div className="min-h-screen bg-white">

      {/* ── STICKY HEADER ─────────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/search" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">← Back</Link>
          <p className="font-bold text-gray-900 text-sm truncate">{vendor.business_name}</p>
          <div className="flex items-center gap-2 shrink-0">
            {/* Message always visible */}
            <button
              onClick={() => setShowMessageModal(true)}
              className="text-sm border border-gray-200 text-gray-700 px-4 py-1.5 rounded-full font-semibold hover:border-green-400 hover:text-green-700 transition-colors"
            >
              💬 Message
            </button>

            {/* Contact dropdown — Call + custom CTA */}
            {(vendor.phone || ctaBtn?.enabled) && (
              <div className="relative">
                <button
                  onClick={() => setShowContactDropdown((v) => !v)}
                  className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold hover:bg-green-700 transition-colors flex items-center gap-1.5"
                >
                  Contact ▾
                </button>
                {showContactDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowContactDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden min-w-[180px]">
                      {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} onClick={() => setShowContactDropdown(false)} className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-800 hover:bg-green-50 transition-colors">
                          📞 <span>Call</span>
                        </a>
                      )}
                      {ctaBtn?.enabled && (
                        ctaBtn.link_type === "url" && ctaBtn.url
                          ? <a href={ctaBtn.url} target="_blank" rel="noreferrer" onClick={() => setShowContactDropdown(false)} className={`flex items-center gap-2.5 px-4 py-3 text-sm text-green-700 font-semibold hover:bg-green-50 transition-colors ${vendor.phone ? "border-t border-gray-100" : ""}`}>
                              ✨ <span>{ctaBtn.label || "Learn More"}</span>
                            </a>
                          : <button onClick={() => { setShowContactDropdown(false); setShowCtaForm(true); }} className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm text-green-700 font-semibold hover:bg-green-50 transition-colors text-left ${vendor.phone ? "border-t border-gray-100" : ""}`}>
                              ✨ <span>{ctaBtn.label || "Contact Us"}</span>
                            </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BANNER (half height) ──────────────────────────────────── */}
      <section className="relative h-36 sm:h-48 overflow-hidden bg-gray-900">
        {vendor.banner_url ? (
          <img src={vendor.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-800 to-blue-600" />
        )}
      </section>

      {/* ── IDENTITY BAR (blue) ───────────────────────────────────── */}
      <div className="bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          {/* Logo */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/20 bg-white/10 overflow-hidden shrink-0 shadow-lg">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-bold text-white">{vendor.business_name[0]}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {vendor.is_verified && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">✓ Verified</span>}
              {vendor.tier === "premium" && <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-semibold">⭐ Local Pro</span>}
              {inboundRefCode && <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-semibold">🪙 Referred</span>}
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white leading-tight">{vendor.business_name}</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">{vendor.category} · {vendor.city}, {vendor.state}</p>
            {vendor.review_count > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex">{stars(vendor.rating, "text-xs")}</div>
                <span className="text-gray-400 text-xs">{vendor.rating.toFixed(1)} ({vendor.review_count} reviews)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTACT INFO (vertical, above tabs) ───────────────────── */}
      {(vendor.phone || vendor.address || vendor.website || vendor.menu_pdf_url) && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1.5">
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700 transition-colors">
                <span className="text-base">📞</span> {vendor.phone}
              </a>
            )}
            {vendor.address && (
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <span className="text-base">📍</span> {vendor.address}, {vendor.city}, {vendor.state}
              </span>
            )}
            {vendor.website && (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700 transition-colors">
                <span className="text-base">🌐</span> {vendor.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {vendor.menu_pdf_url && (
              <a href={vendor.menu_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors">
                <span className="text-base">📄</span> View Menu
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── NAV TABS ──────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {(["services", "reviews", "about"] as const).map((s) => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-5 py-3.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
                  activeSection === s ? "border-green-600 text-green-700" : "border-transparent text-gray-400 hover:text-gray-700"
                }`}>
                {s === "services" ? "Services & Products" : s}
                {s === "services" && listings.length > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{listings.length}</span>}
                {s === "reviews" && localReviews.length > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{localReviews.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* ── SERVICES & PRODUCTS ───────────────────────────────── */}
        {activeSection === "services" && (
          <div>
            {vendor.description && (
              <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-2xl">{vendor.description}</p>
            )}
            {orderedListings.length === 0 ? (
              <>
                {pageBlocks.length > 0 && renderPhotoBlocks()}
                {pageBlocks.length === 0 && (
                  <div className="text-center py-20 text-gray-300">
                    <p className="text-5xl mb-4">📦</p>
                    <p className="text-gray-400">No listings yet.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Top 3 products */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orderedListings.slice(0, 3).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      vendorName={vendor.business_name}
                      vendorPhone={vendor.phone}
                      onBook={() => openBooking(listing)}
                      onBuy={() => { trackClick(listing.id); setBuyListing(listing); }}
                      onMessage={() => { trackClick(listing.id); setMessageListing(listing); }}
                    />
                  ))}
                </div>

                {/* Photo content blocks, shown under the top 3 products */}
                {pageBlocks.length > 0 && (
                  <div className="my-10 border-y border-gray-100">{renderPhotoBlocks()}</div>
                )}

                {/* Remaining products */}
                {orderedListings.length > 3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    {orderedListings.slice(3).map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        vendorName={vendor.business_name}
                        vendorPhone={vendor.phone}
                        onBook={() => openBooking(listing)}
                        onBuy={() => { trackClick(listing.id); setBuyListing(listing); }}
                        onMessage={() => { trackClick(listing.id); setMessageListing(listing); }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── REVIEWS ───────────────────────────────────────────── */}
        {activeSection === "reviews" && (
          <div className="max-w-2xl">
            {localReviews.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-6 mb-8 flex items-center gap-8">
                <div className="text-center">
                  <p className="text-5xl font-black text-gray-900">{vendor.rating.toFixed(1)}</p>
                  <div className="flex justify-center mt-1">{stars(vendor.rating, "text-lg")}</div>
                  <p className="text-xs text-gray-400 mt-1">{localReviews.length} reviews</p>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = localReviews.filter((r) => Math.round(r.rating) === n).length;
                    const pct = localReviews.length > 0 ? (count / localReviews.length) * 100 : 0;
                    return (
                      <div key={n} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-500 w-2">{n}</span>
                        <span className="text-amber-400 text-xs">★</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentUserId && !reviewSuccess && (
              <div className="mb-6">
                {!showReviewForm ? (
                  <button onClick={() => setShowReviewForm(true)}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors font-medium">
                    ⭐ Leave a review — earn 5 Local Bucks
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
                    <h3 className="font-bold text-gray-900 mb-4">Write a review</h3>
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setReviewRating(n)} className={`text-3xl transition-transform hover:scale-110 ${n <= reviewRating ? "text-amber-400" : "text-gray-200"}`}>★</button>
                      ))}
                      <span className="ml-2 text-sm text-gray-400 self-center">{["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}</span>
                    </div>
                    <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={4}
                      placeholder="Share your experience..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                    {reviewError && <p className="text-xs text-red-600 mt-2">{reviewError}</p>}
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setShowReviewForm(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">Cancel</button>
                      <button onClick={submitReview} disabled={submittingReview} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                        {submittingReview ? "Submitting..." : "Submit (+5 LB 🪙)"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {reviewSuccess && <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-center"><p className="text-green-700 font-semibold">✓ Review submitted — you earned 5 Local Bucks! 🪙</p></div>}
            {!currentUserId && (
              <div className="mb-6 bg-gray-50 rounded-2xl p-4 text-center text-sm text-gray-500">
                <Link href="/signup" className="text-green-600 font-medium hover:underline">Sign up</Link> or <Link href="/login" className="text-green-600 font-medium hover:underline">log in</Link> to leave a review.
              </div>
            )}
            <div className="space-y-4">
              {localReviews.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden">
                        {r.reviewer?.avatar_url ? <img src={r.reviewer.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.reviewer?.full_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.reviewer?.full_name ?? "Anonymous"}</p>
                        <div className="flex">{stars(r.rating, "text-xs")}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{r.comment}</p>}
                </div>
              ))}
              {localReviews.length === 0 && (
                <div className="text-center py-16 text-gray-300">
                  <p className="text-5xl mb-3">⭐</p>
                  <p className="text-gray-400">No reviews yet. Be the first!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABOUT ─────────────────────────────────────────────── */}
        {activeSection === "about" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-3">About {vendor.business_name}</h2>
              {vendor.description
                ? <p className="text-gray-600 leading-relaxed whitespace-pre-line">{vendor.description}</p>
                : <p className="text-gray-400">No description provided yet.</p>}
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h2 className="text-xl font-black text-gray-900">Contact & Location</h2>
              {vendor.address && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-xl">📍</span>
                  <div><p className="font-semibold text-gray-700">Address</p><p className="text-gray-500">{vendor.address}, {vendor.city}, {vendor.state} {vendor.zip_code}</p></div>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-xl">📞</span>
                  <div><p className="font-semibold text-gray-700">Phone</p><a href={`tel:${vendor.phone}`} className="text-green-600 hover:underline">{vendor.phone}</a></div>
                </div>
              )}
              {vendor.website && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-xl">🌐</span>
                  <div><p className="font-semibold text-gray-700">Website</p><a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline break-all">{vendor.website}</a></div>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <span className="text-xl">🗺️</span>
                <div><p className="font-semibold text-gray-700">Service Area</p><p className="text-gray-500">Within {vendor.service_radius_miles} miles of {vendor.city}, {vendor.state}</p></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
              <h3 className="font-bold mb-1">Know someone who'd love this business?</h3>
              <p className="text-green-100 text-sm mb-4">Share your link and earn <strong>50 Local Bucks</strong> when they sign up.</p>
              <button onClick={copyShareLink} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${copied ? "bg-white text-green-700" : "bg-white/20 text-white hover:bg-white/30"}`}>
                {copied ? "✓ Copied!" : currentUserReferralCode ? "Copy your referral link" : "Copy link"}
              </button>
              {!currentUserId && <p className="text-green-200 text-xs text-center mt-2"><Link href="/signup" className="underline">Sign up</Link> to get your referral link</p>}
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER CTA ────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-t border-gray-100 py-10 px-4 text-center">
        <p className="text-gray-400 text-sm mb-1">Powered by</p>
        <Link href="/" className="text-green-600 font-bold text-lg">Everything Local</Link>
        {!currentUserId && (
          <p className="text-sm text-gray-400 mt-3">
            <Link href="/signup" className="text-green-600 font-semibold hover:underline">Create a free account</Link> to message, book, and earn Local Bucks.
          </p>
        )}
      </div>
    </div>
  </>);
}

/* ─── LISTING CARD ────────────────────────────────────────────────── */
function ListingCard({ listing, vendorName, vendorPhone, onBook, onBuy, onMessage }: {
  listing: Listing; vendorName: string; vendorPhone: string | null;
  onBook: () => void; onBuy: () => void; onMessage: () => void;
}) {
  const TYPE_ICON: Record<string, string> = { product: "📦", service: "🔧", restaurant: "🍽️", event: "🎉", rental: "🏠", thrift: "🏷️", housing_sale: "🏠", housing_rent: "🏡" };

  let housingData: any = null;
  if (listing.type === "housing_sale" || listing.type === "housing_rent") {
    try { const t = listing.tags?.find((t) => t.startsWith("__housing:")); if (t) housingData = JSON.parse(t.replace("__housing:", "")); } catch {}
  }
  let thriftData: { address: string | null; openDays: { day: string; open: string; close: string }[] } | null = null;
  if (listing.type === "thrift") {
    try {
      const t = listing.tags?.find((t) => t.startsWith("__hours:")); let hours: any[] = [];
      if (t) hours = JSON.parse(t.replace("__hours:", ""));
      thriftData = { address: listing.price_label, openDays: hours.filter((h) => !h.closed && h.open && h.close) };
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      {/* Image */}
      <div className="h-52 bg-gray-50 relative overflow-hidden">
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">{TYPE_ICON[listing.type] ?? "📦"}</div>}
        {listing.is_featured && <span className="absolute top-3 left-3 bg-amber-400 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">Featured</span>}
        {listing.quantity === 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span></div>}
      </div>

      <div className="p-5">
        <h3 className="font-bold text-gray-900 leading-snug mb-1">{listing.title}</h3>
        {listing.description && <p className="text-sm text-gray-400 line-clamp-2 mb-3">{listing.description}</p>}

        {/* Housing details */}
        {housingData && (
          <div className="mb-3 space-y-1">
            {housingData.address && <p className="text-xs text-gray-500">📍 {housingData.address}</p>}
            <div className="flex flex-wrap gap-1.5">
              {housingData.bedrooms && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🛏 {housingData.bedrooms} bd</span>}
              {housingData.bathrooms && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🚿 {housingData.bathrooms} ba</span>}
              {housingData.sqft && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">📐 {housingData.sqft} sqft</span>}
              {housingData.garage && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🚗 Garage</span>}
              {housingData.pets_allowed && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🐾 Pets OK</span>}
            </div>
            {listing.type === "housing_rent" && housingData.available_date && <p className="text-xs text-green-600 font-semibold">Available {new Date(housingData.available_date).toLocaleDateString()}</p>}
          </div>
        )}

        {/* Thrift details */}
        {thriftData && (
          <div className="mb-3 space-y-1">
            {thriftData.address && <p className="text-xs text-gray-500">📍 {thriftData.address}</p>}
            {thriftData.openDays.length > 0 && <p className="text-xs text-gray-500">🕐 {thriftData.openDays.map((h) => `${h.day.slice(0,3)} ${h.open}–${h.close}`).join(" · ")}</p>}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {listing.type !== "thrift" && listing.type !== "housing_sale" && listing.type !== "housing_rent" && listing.price !== null
              ? <span className="text-lg font-black text-green-700">{formatPrice(listing.price)}</span>
              : listing.type !== "thrift" && listing.type !== "housing_sale" && listing.type !== "housing_rent" && listing.price_label
              ? <span className="text-sm text-gray-500">{listing.price_label}</span>
              : (listing.type === "housing_sale" || listing.type === "housing_rent")
              ? <span className="text-lg font-black text-green-700">{listing.price ? `${formatPrice(listing.price)}${listing.type === "housing_rent" ? "/mo" : ""}` : listing.price_label ?? (listing.type === "housing_sale" ? "For Sale" : "For Rent")}</span>
              : null}
            {listing.condition && <span className="ml-2 text-xs text-gray-400 capitalize">{listing.condition}</span>}
          </div>
          {listing.quantity !== null && listing.quantity > 0 && listing.type !== "rental" && (
            <span className="text-xs text-gray-400">{listing.quantity} left</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          {listing.type === "rental" && (
            <button onClick={onBook} className="w-full bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">📅 Book Now</button>
          )}
          {listing.type !== "rental" && listing.type !== "thrift" && BUY_NOW_CATEGORIES.some((c) => listing.category?.includes(c.split(" ")[0])) && (
            <button onClick={onBuy} className="w-full bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">🛒 Buy Now</button>
          )}
          <button onClick={onMessage} className="w-full border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:border-green-400 hover:text-green-700 transition-colors">
            💬 Message {vendorName}
          </button>
          {vendorPhone && (
            <a href={`tel:${vendorPhone}`} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
              📞 Call Now
            </a>
          )}
        </div>

        {/* Tags */}
        {(listing.tags ?? []).filter((t) => !t.startsWith("__")).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {(listing.tags ?? []).filter((t) => !t.startsWith("__")).slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
