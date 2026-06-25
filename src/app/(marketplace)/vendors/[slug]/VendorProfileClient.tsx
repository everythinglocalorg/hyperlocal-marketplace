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

type Vendor = {
  id: string;
  business_name: string;
  slug: string;
  description: string | null;
  category: string;
  city: string;
  state: string;
  zip_code: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  banner_url: string | null;
  tier: string;
  is_verified: boolean;
  rating: number;
  review_count: number;
  local_bucks_earned: number;
  service_radius_miles: number;
};

type Listing = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  price: number | null;
  price_label: string | null;
  condition: string | null;
  quantity: number | null;
  images: string[];
  category: string;
  tags: string[] | null;
  is_featured: boolean;
  view_count: number;
  waiver_url: string | null;
  waiver_filename: string | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

interface Props {
  vendor: Vendor;
  listings: Listing[];
  reviews: Review[];
  currentUserId: string | null;
  currentUserReferralCode: string | null;
  inboundRefCode: string | null;
}

export default function VendorProfileClient({
  vendor, listings, reviews, currentUserId, currentUserReferralCode, inboundRefCode,
}: Props) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"listings" | "reviews" | "about">("listings");
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

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await client.from("profiles").select("id, full_name").eq("id", user.id).single();
      if (profile) setCurrentUser({ ...profile, email: user.email });
    });
  }, []);

  async function openBooking(listing: Listing) {
    const { data: durations } = await supabase.from("rental_durations").select("*").eq("listing_id", listing.id).order("hours");
    setBookingDurations(durations ?? []);
    setBookingListing(listing);
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Shareable link — uses the logged-in user's referral code if available
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
      vendor_id: vendor.id,
      reviewer_id: currentUserId,
      rating: reviewRating,
      comment: reviewComment || null,
    });

    if (error) {
      setReviewError(error.message.includes("unique") ? "You've already reviewed this vendor." : error.message);
    } else {
      // Award Local Bucks for leaving a review
      await supabase.rpc("award_local_bucks", {
        p_user_id: currentUserId,
        p_amount: 5,
        p_reason: "leave_review",
        p_reference_id: vendor.id,
        p_reference_type: "vendor",
      });

      setLocalReviews((prev) => [{
        id: Date.now().toString(),
        rating: reviewRating,
        comment: reviewComment || null,
        created_at: new Date().toISOString(),
        reviewer: { full_name: "You", avatar_url: null },
      }, ...prev]);

      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewComment("");
      setReviewRating(5);
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

  return (<>
    {messageListing && (
      <MessageModal
        listing={{ id: messageListing.id, title: messageListing.title }}
        vendor={{ id: vendor.id, business_name: vendor.business_name }}
        currentUser={currentUser}
        onClose={() => setMessageListing(null)}
      />
    )}
    {buyListing && (
      <BuyNowModal
        listing={{ id: buyListing.id, title: buyListing.title, price: buyListing.price, price_label: buyListing.price_label }}
        vendor={{ id: vendor.id, business_name: vendor.business_name }}
        currentUser={currentUser}
        inquiryType="buy"
        onClose={() => setBuyListing(null)}
      />
    )}
    {bookingListing && (
      <RentalBookingModal
        listing={{ id: bookingListing.id, title: bookingListing.title, waiver_url: bookingListing.waiver_url, waiver_filename: bookingListing.waiver_filename }}
        vendor={{ id: vendor.id, business_name: vendor.business_name }}
        durations={bookingDurations}
        currentUser={currentUser}
        onClose={() => setBookingListing(null)}
      />
    )}
    <div className="min-h-screen bg-gray-50">
      {/* Nav bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/search" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            ← Back to search
          </Link>
          <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
          <div className="flex items-center gap-2">
            {currentUserId ? (
              <Link href="/dashboard/vendor" className="text-sm text-gray-500 hover:text-gray-700">Dashboard</Link>
            ) : (
              <Link href="/signup" className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                Sign up free
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="relative h-56 sm:h-72 bg-gradient-to-br from-green-200 to-emerald-400 overflow-hidden">
        {vendor.banner_url && (
          <img src={vendor.banner_url} alt="" className="w-full h-full object-cover" />
        )}
        {/* Inbound referral badge */}
        {inboundRefCode && (
          <div className="absolute top-4 right-4 bg-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
            🪙 Referred — sign up to earn Local Bucks
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative -mt-24 mb-4 flex items-end justify-between">
          {/* Logo */}
          <div className="w-52 h-52 rounded-2xl border-4 border-white shadow-md bg-white overflow-hidden shrink-0">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-green-100 flex items-center justify-center text-7xl font-bold text-green-600">{vendor.business_name[0]}</div>}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pb-1">
            <button
              onClick={copyShareLink}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                copied ? "bg-green-500 text-white border-green-500" : "bg-white border-gray-200 text-gray-600 hover:border-green-400"
              }`}
            >
              {copied ? "✓ Copied!" : "🔗 Share"}
            </button>
            {vendor.phone && (
              <a
                href={`tel:${vendor.phone}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                📞 Call
              </a>
            )}
          </div>
        </div>

        {/* Business info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{vendor.business_name}</h1>
            {vendor.is_verified && (
              <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-semibold border border-green-200">
                ✓ Local Verified
              </span>
            )}
            {vendor.tier === "premium" && (
              <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold border border-amber-200">
                🏅 Founding Member
              </span>
            )}
          </div>

          <p className="text-gray-500 text-sm mt-1">{vendor.category} · {vendor.city}, {vendor.state}</p>

          {/* Rating */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex">{stars(vendor.rating)}</div>
            <span className="text-sm font-semibold text-gray-700">
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : "No reviews yet"}
            </span>
            {vendor.review_count > 0 && (
              <span className="text-sm text-gray-400">({vendor.review_count} reviews)</span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            {vendor.address && (
              <span className="flex items-center gap-1">📍 {vendor.address}, {vendor.city}</span>
            )}
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 hover:text-green-600">
                📞 {vendor.phone}
              </a>
            )}
            {vendor.website && (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-green-600 truncate max-w-[200px]">
                🔗 {vendor.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="flex items-center gap-1">🗺️ Serves {vendor.service_radius_miles} mi radius</span>
          </div>

          {/* Local Bucks earned */}
          {vendor.local_bucks_earned > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
              <span className="text-amber-500">🪙</span>
              <span className="text-sm font-medium text-amber-700">
                {vendor.local_bucks_earned.toLocaleString()} Local Bucks earned
              </span>
            </div>
          )}
        </div>

        {/* Share CTA for logged-in users */}
        {currentUserReferralCode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">Share this business & earn 50 Local Bucks</p>
              <p className="text-xs text-amber-600 mt-0.5">Your unique referral link is already attached when you copy it.</p>
            </div>
            <button
              onClick={copyShareLink}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                copied ? "bg-green-500 text-white" : "bg-amber-400 text-white hover:bg-amber-500"
              }`}
            >
              {copied ? "Copied! ✓" : "Copy link"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {(["listings", "reviews", "about"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === t
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              {t === "listings" && listings.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {listings.length}
                </span>
              )}
              {t === "reviews" && localReviews.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {localReviews.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── LISTINGS TAB ── */}
        {activeTab === "listings" && (
          <div className="pb-12">
            {orderedListings.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📦</p>
                <p>No listings yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {orderedListings.map((listing) => (
                  <div key={listing.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    {/* Image */}
                    <div className="h-44 bg-gray-100 relative overflow-hidden">
                      {listing.images?.[0] ? (
                        <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                          {({ product:"📦", service:"🔧", restaurant:"🍽️", event:"🎉", rental:"🏠", thrift:"🏷️" } as Record<string,string>)[listing.type] ?? "📦"}
                        </div>
                      )}
                      {listing.is_featured && (
                        <span className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                      {listing.quantity === 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug">{listing.title}</h3>
                      {listing.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{listing.description}</p>
                      )}

                      {listing.type === "thrift" && (() => {
                        const address = listing.price_label;
                        const hoursTag = listing.tags?.find((t) => t.startsWith("__hours:"));
                        let hours: { day: string; open: string; close: string; closed: boolean }[] = [];
                        try { if (hoursTag) hours = JSON.parse(hoursTag.replace("__hours:", "")); } catch {}
                        const openDays = hours.filter((h) => !h.closed && h.open && h.close);
                        return (
                          <div className="mt-2 space-y-1">
                            {address && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">📍 {address}</p>
                            )}
                            {openDays.length > 0 && (
                              <div className="text-xs text-gray-500">
                                🕐 {openDays.map((h) => `${h.day.slice(0,3)} ${h.open}–${h.close}`).join(" · ")}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between mt-3">
                        <div>
                          {listing.type !== "thrift" && listing.price !== null ? (
                            <span className="font-bold text-green-700">{formatPrice(listing.price)}</span>
                          ) : listing.type !== "thrift" && listing.price_label ? (
                            <span className="text-sm text-gray-600">{listing.price_label}</span>
                          ) : null}
                          {listing.condition && (
                            <span className="ml-2 text-xs text-gray-400 capitalize">{listing.condition}</span>
                          )}
                        </div>
                        {listing.type === "rental" && (
                          <button
                            onClick={() => openBooking(listing)}
                            className="text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                            📅 Book Now
                          </button>
                        )}
                        {listing.type !== "rental" && listing.type !== "thrift" && BUY_NOW_CATEGORIES.some((c) => listing.category?.includes(c.split(" ")[0])) && (
                          <button
                            onClick={() => setBuyListing(listing)}
                            className="text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                            🛒 Buy Now
                          </button>
                        )}
                        {listing.quantity !== null && listing.quantity > 0 && listing.type !== "rental" && (
                          <span className="text-xs text-gray-400">{listing.quantity} left</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => setMessageListing(listing)}
                          className="w-full text-xs border border-gray-200 text-gray-600 font-medium px-3 py-1.5 rounded-full hover:border-green-400 hover:text-green-700 transition-colors">
                          💬 Message {vendor.business_name}
                        </button>
                      </div>

                      {(listing.tags ?? []).filter((t) => !t.startsWith("__")).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(listing.tags ?? []).filter((t) => !t.startsWith("__")).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}

                      {vendor.phone && (
                        <a
                          href={`tel:${vendor.phone}`}
                          className="mt-3 w-full flex items-center justify-center gap-2 bg-green-600 text-white text-sm py-2 rounded-xl hover:bg-green-700 transition-colors font-medium"
                        >
                          📞 Contact Vendor
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === "reviews" && (
          <div className="pb-12">
            {/* Review summary */}
            {localReviews.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex items-center gap-8">
                <div className="text-center">
                  <p className="text-5xl font-bold text-gray-900">{vendor.rating.toFixed(1)}</p>
                  <div className="flex justify-center mt-1">{stars(vendor.rating, "text-lg")}</div>
                  <p className="text-xs text-gray-400 mt-1">{localReviews.length} reviews</p>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = localReviews.filter((r) => Math.round(r.rating) === n).length;
                    const pct = localReviews.length > 0 ? (count / localReviews.length) * 100 : 0;
                    return (
                      <div key={n} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 w-2">{n}</span>
                        <span className="text-amber-400 text-xs">★</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leave a review */}
            {currentUserId && !reviewSuccess && (
              <div className="mb-6">
                {!showReviewForm ? (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
                  >
                    ⭐ Leave a review — earn 5 Local Bucks
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Write a review</h3>

                    {/* Star picker */}
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setReviewRating(n)}
                          className={`text-3xl transition-transform hover:scale-110 ${n <= reviewRating ? "text-amber-400" : "text-gray-200"}`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-500 self-center">
                        {["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}
                      </span>
                    </div>

                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={4}
                      placeholder="Share your experience with this vendor..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />

                    {reviewError && (
                      <p className="text-xs text-red-600 mt-2">{reviewError}</p>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setShowReviewForm(false)}
                        className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitReview}
                        disabled={submittingReview}
                        className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {submittingReview ? "Submitting..." : "Submit Review (+5 LB 🪙)"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {reviewSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-center">
                <p className="text-green-700 font-semibold">✓ Review submitted — you earned 5 Local Bucks! 🪙</p>
              </div>
            )}

            {!currentUserId && (
              <div className="mb-6 bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">
                  <Link href="/signup" className="text-green-600 font-medium hover:underline">Sign up</Link> or{" "}
                  <Link href="/login" className="text-green-600 font-medium hover:underline">log in</Link> to leave a review and earn 5 Local Bucks.
                </p>
              </div>
            )}

            {/* Review list */}
            {localReviews.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">⭐</p>
                <p>No reviews yet. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {localReviews.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 text-sm overflow-hidden">
                          {r.reviewer?.avatar_url
                            ? <img src={r.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (r.reviewer?.full_name ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.reviewer?.full_name ?? "Anonymous"}</p>
                          <div className="flex">{stars(r.rating, "text-xs")}</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABOUT TAB ── */}
        {activeTab === "about" && (
          <div className="pb-12">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">About {vendor.business_name}</h2>
              {vendor.description ? (
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{vendor.description}</p>
              ) : (
                <p className="text-gray-400 text-sm">No description provided yet.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <h2 className="font-semibold text-gray-900 mb-4">Contact & Location</h2>
              <div className="space-y-3 text-sm">
                {vendor.address && (
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">📍</span>
                    <div>
                      <p className="font-medium text-gray-700">Address</p>
                      <p className="text-gray-500">{vendor.address}, {vendor.city}, {vendor.state} {vendor.zip_code}</p>
                    </div>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">📞</span>
                    <div>
                      <p className="font-medium text-gray-700">Phone</p>
                      <a href={`tel:${vendor.phone}`} className="text-green-600 hover:underline">{vendor.phone}</a>
                    </div>
                  </div>
                )}
                {vendor.website && (
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">🌐</span>
                    <div>
                      <p className="font-medium text-gray-700">Website</p>
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline break-all">
                        {vendor.website}
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">🗺️</span>
                  <div>
                    <p className="font-medium text-gray-700">Service Area</p>
                    <p className="text-gray-500">Within {vendor.service_radius_miles} miles of {vendor.city}, {vendor.state}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Share card */}
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
              <h3 className="font-bold mb-1">Know someone who'd love this business?</h3>
              <p className="text-green-100 text-sm mb-4">
                Share your link and earn <strong>50 Local Bucks</strong> when they make their first purchase.
              </p>
              <button
                onClick={copyShareLink}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  copied ? "bg-white text-green-700" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {copied ? "✓ Link copied!" : currentUserReferralCode ? "Copy your referral link" : "Copy link"}
              </button>
              {!currentUserId && (
                <p className="text-green-200 text-xs text-center mt-2">
                  <Link href="/signup" className="underline">Sign up</Link> to get your referral link and earn Local Bucks
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </>);
}
