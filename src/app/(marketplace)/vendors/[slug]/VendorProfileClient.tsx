"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";
import RentalBookingModal from "@/components/rental/RentalBookingModal";
import BuyNowModal from "@/components/BuyNowModal";
import MessageModal from "@/components/MessageModal";
import { LISTING_CTAS, ListingCtaAction, isListingCtaType } from "@/lib/cta";

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
  is_verified: boolean; is_claimed: boolean; rating: number; review_count: number;
  local_bucks_earned: number; service_radius_miles: number;
  service_locations?: string[] | null;
  page_blocks?: PageBlock[] | null;
  menu_pdf_url?: string | null;
  cta_button?: { action?: "call" | "estimate" | "order"; url?: string } | null;
};

// Categories where customers request estimates rather than just "getting in touch".
const SERVICE_CATEGORIES = new Set<string>([
  "Services & Trades",
  "Home & Garden",
  "Auto & Transportation",
  "Pet Services",
  "Childcare & Education",
  "Events & Rentals",
  "Health & Beauty",
]);

type Listing = {
  id: string; title: string; description: string | null; type: string;
  price: number | null; price_label: string | null; condition: string | null;
  quantity: number | null; images: string[]; category: string;
  tags: string[] | null; is_featured: boolean; view_count: number;
  waiver_url: string | null; waiver_filename: string | null;
  cta_type?: string | null;
};

type Review = {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

// Scroll-nav sections; "menu" is only rendered when vendor.menu_pdf_url exists.
type Section = "about" | "services" | "menu" | "reviews";

interface Props {
  vendor: Vendor; listings: Listing[]; reviews: Review[];
  currentUserId: string | null; currentUserReferralCode: string | null; inboundRefCode: string | null;
}

export default function VendorProfileClient({ vendor, listings, reviews, currentUserId, currentUserReferralCode, inboundRefCode }: Props) {
  const supabase = createClient();
  const [activeSection, setActiveSection] = useState<Section>("services");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // "menu" only appears when the vendor has a saved menu PDF.
  const navSections: Section[] = vendor.menu_pdf_url
    ? ["about", "services", "menu", "reviews"]
    : ["about", "services", "reviews"];

  const scrollToSection = useCallback((s: Section) => {
    setActiveSection(s);
    const el = sectionRefs.current[s];
    if (el) {
      const offset = 150; // global header + sticky vendor nav
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Update active tab highlight as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as Section);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    const sections: Section[] = vendor.menu_pdf_url
      ? ["services", "menu", "reviews", "about"]
      : ["services", "reviews", "about"];
    sections.forEach((s) => {
      const el = sectionRefs.current[s];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [vendor.menu_pdf_url]);
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
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
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

  const ctaBtn = vendor.cta_button as { action?: "call" | "estimate" | "order"; url?: string } | null;
  const ctaAction = ctaBtn?.action ?? null;
  const ctaOrderUrl = ctaBtn?.url ?? null;
  const CTA_LABELS: Record<string, string> = { call: "Call", estimate: "Request Free Estimate", order: "Order Now" };

  // Hide the "website" link when it just points back to Everything Local itself
  // (imported vendors default their website to every1local.com/vendors/…).
  const externalWebsite = vendor.website && !/every1local\.com/i.test(vendor.website) ? vendor.website : null;

  // Service-based businesses request estimates; product/food/retail businesses "get in touch".
  const isServiceBased = SERVICE_CATEGORIES.has(vendor.category);
  const inquiryHeading = isServiceBased ? "Request A Free Estimate" : "Get in Touch";
  const inquirySubmitLabel = isServiceBased ? "Request Free Estimate →" : "Send Message →";

  // Sidebar inquiry form state
  const [sidebarName, setSidebarName] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [sidebarPhone, setSidebarPhone] = useState("");
  const [sidebarMessage, setSidebarMessage] = useState("");
  const [sidebarSubmitting, setSidebarSubmitting] = useState(false);
  const [sidebarDone, setSidebarDone] = useState(false);

  async function submitSidebarInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSidebarSubmitting(true);
    await supabase.from("purchase_inquiries").insert({
      vendor_id: vendor.id,
      buyer_id: currentUser?.id ?? null,
      buyer_name: sidebarName,
      buyer_email: sidebarEmail,
      buyer_phone: sidebarPhone || null,
      message: sidebarMessage,
      inquiry_type: "general",
    });
    fetch("/api/inquiry-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: vendor.id,
        buyerName: sidebarName,
        buyerEmail: sidebarEmail,
        buyerPhone: sidebarPhone || null,
        message: sidebarMessage,
        inquiryType: "general",
      }),
    }).catch(() => {});
    setSidebarSubmitting(false);
    setSidebarDone(true);
  }

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
      message: ctaFormMessage,
      inquiry_type: ctaAction ?? "cta",
    });
    fetch("/api/inquiry-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: vendor.id,
        buyerName: ctaFormName,
        buyerEmail: ctaFormEmail,
        buyerPhone: ctaFormPhone || null,
        message: ctaFormMessage,
        inquiryType: ctaAction ?? "cta",
      }),
    }).catch(() => {});
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

  // First-party analytics: full event with context (every view, not session-deduped)
  useEffect(() => {
    track("vendor_profile_view", {
      vendor_id: vendor.id,
      vendor_slug: vendor.slug,
      category: vendor.category,
      city: `${vendor.city}, ${vendor.state}`,
      tier: vendor.tier,
      is_claimed: vendor.is_claimed,
      logged_in: !!currentUserId,
      via_referral: !!inboundRefCode,
    });
    if (!vendor.is_claimed) {
      track("claim_banner_view", { vendor_id: vendor.id, vendor_slug: vendor.slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

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
    {showCtaForm && (ctaAction === "estimate" || ctaAction === "order") && (
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
                <h3 className="text-lg font-bold text-gray-900">{ctaAction ? CTA_LABELS[ctaAction] : "Contact Us"}</h3>
                <button onClick={() => setShowCtaForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <form onSubmit={submitCtaForm} className="space-y-3">
                <input required value={ctaFormName} onChange={(e) => setCtaFormName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input required type="email" value={ctaFormEmail} onChange={(e) => setCtaFormEmail(e.target.value)} placeholder="Email address" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={ctaFormPhone} onChange={(e) => setCtaFormPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

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

    {/* Listing detail popup — full photos/details; its sticky action bar reuses the same CTA handlers */}
    {detailListing && (
      <ListingDetailModal
        listing={detailListing}
        vendorPhone={vendor.phone}
        menuPdfUrl={vendor.menu_pdf_url ?? null}
        onClose={() => setDetailListing(null)}
        onBook={() => { const l = detailListing; setDetailListing(null); openBooking(l); }}
        onBuy={() => { const l = detailListing; setDetailListing(null); trackClick(l.id); setBuyListing(l); }}
        onMessage={() => { const l = detailListing; setDetailListing(null); trackClick(l.id); setMessageListing(l); }}
      />
    )}

    <div className="min-h-screen bg-white">

      {/* ── UNCLAIMED BUSINESS BANNER ─────────────────────────────── */}
      {!vendor.is_claimed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <span className="text-base">🏪</span>
              <span><strong>Is this your business?</strong> Claim this free profile to edit your info, add listings, and connect with customers.</span>
            </div>
            <a
              href={`/claim/${vendor.slug}`}
              onClick={() => track("claim_banner_click", { vendor_id: vendor.id, vendor_slug: vendor.slug })}
              className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              Claim it free →
            </a>
          </div>
        </div>
      )}

      {/* ── STICKY VENDOR NAV (sits below the global header) ───────── */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {/* Back + Logo */}
          <Link href="/search" className="text-gray-400 hover:text-gray-700 transition-colors text-xl shrink-0 leading-none">←</Link>
          <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-contain" />
              : <div className="w-full h-full flex items-center justify-center font-bold text-gray-700 text-sm">{vendor.business_name[0]}</div>}
          </div>
          <div className="hidden sm:block min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-sm truncate max-w-[160px] md:max-w-[220px] leading-tight">{vendor.business_name}</p>
            <p className="text-gray-400 text-xs truncate max-w-[160px] md:max-w-[220px]">{vendor.city}, {vendor.state}</p>
          </div>

          {/* Desktop tab nav */}
          <nav className="hidden md:flex items-center gap-0 ml-2 h-16">
            {navSections.map((s) => (
              <button key={s} onClick={() => scrollToSection(s)}
                className={`px-4 h-full text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === s ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
                }`}>
                {s === "services" ? "Services & Products" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s === "services" && listings.length > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{listings.length}</span>}
                {s === "reviews" && localReviews.length > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{localReviews.length}</span>}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="hidden lg:flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg px-3 py-2 font-medium">
                📞 {vendor.phone}
              </a>
            )}
            <button
              onClick={() => setShowMessageModal(true)}
              className="text-sm border border-gray-200 text-gray-700 px-2.5 py-2 rounded-lg font-semibold hover:border-gray-400 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">💬 Message</span>
              <span className="sm:hidden text-lg leading-none">💬</span>
            </button>
            {ctaAction && (
              ctaAction === "call" && vendor.phone ? (
                <a href={`tel:${vendor.phone}`} className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                  <span className="hidden sm:inline">{CTA_LABELS[ctaAction]} →</span>
                  <span className="sm:hidden text-lg leading-none">📞</span>
                </a>
              ) : ctaAction === "order" && ctaOrderUrl ? (
                <a href={ctaOrderUrl} target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                  <span className="hidden sm:inline">{CTA_LABELS[ctaAction]} →</span>
                  <span className="sm:hidden text-lg leading-none">🛒</span>
                </a>
              ) : ctaAction !== "call" ? (
                <button onClick={() => setShowCtaForm(true)} className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                  <span className="hidden sm:inline">{CTA_LABELS[ctaAction]} →</span>
                  <span className="sm:hidden text-lg leading-none">{ctaAction === "estimate" ? "📋" : "🛒"}</span>
                </button>
              ) : null
            )}
          </div>
        </div>

        {/* Mobile tab row */}
        <div className="md:hidden border-t border-gray-100 flex">
          {navSections.map((s) => (
            <button key={s} onClick={() => scrollToSection(s)}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeSection === s ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400"
              }`}>
              {s === "services" ? "Services" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 w-full">

        {/* ── ABOUT ─────────────────────────────────────────────── */}
        <div id="about" ref={(el) => { sectionRefs.current.about = el; }} className="max-w-2xl mb-12">
          <h2 className="text-xl font-black text-gray-900 mb-3">About {vendor.business_name}</h2>
          {vendor.description
            ? <p className="text-gray-600 leading-relaxed whitespace-pre-line">{vendor.description}</p>
            : <p className="text-gray-400">No description provided yet.</p>}
        </div>

        {/* ── SERVICES & PRODUCTS ───────────────────────────────── */}
        <div id="services" ref={(el) => { sectionRefs.current.services = el; }}>
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
                      menuPdfUrl={vendor.menu_pdf_url ?? null}
                      onOpen={() => setDetailListing(listing)}
                      onBook={() => openBooking(listing)}
                      onBuy={() => { trackClick(listing.id); setBuyListing(listing); }}
                      onMessage={() => { trackClick(listing.id); setMessageListing(listing); }}
                    />
                  ))}
                </div>

                {/* Photo content blocks */}
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
                        menuPdfUrl={vendor.menu_pdf_url ?? null}
                        onOpen={() => setDetailListing(listing)}
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

        {/* ── MENU (only when a menu PDF is saved) ──────────────── */}
        {vendor.menu_pdf_url && (
          <div id="menu" ref={(el) => { sectionRefs.current.menu = el; }} className="mt-16 pt-8 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <h2 className="text-xl font-black text-gray-900">🍽️ Menu</h2>
              <a
                href={vendor.menu_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Open Menu (PDF) →
              </a>
            </div>
            {/* PDF embeds are unreliable on mobile browsers — the button above covers small screens */}
            <iframe
              src={vendor.menu_pdf_url}
              title={`${vendor.business_name} menu`}
              className="hidden sm:block w-full h-[600px] rounded-2xl border border-gray-200"
            />
          </div>
        )}

        {/* ── CONTACT & LOCATION ────────────────────────────────── */}
        <div className="max-w-2xl mt-16 pt-8 border-t border-gray-100 space-y-4">
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
          {externalWebsite && (
            <div className="flex items-start gap-3 text-sm">
              <span className="text-xl">🌐</span>
              <div><p className="font-semibold text-gray-700">Website</p><a href={externalWebsite} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline break-all">{externalWebsite}</a></div>
            </div>
          )}
          <div className="flex items-start gap-3 text-sm">
            <span className="text-xl">🗺️</span>
            <div>
              <p className="font-semibold text-gray-700">Service Area</p>
              <p className="text-gray-500">Within {vendor.service_radius_miles} miles of {vendor.city}, {vendor.state}</p>
              {vendor.service_locations && vendor.service_locations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vendor.service_locations.map((loc) => (
                    <span key={loc} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{loc}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white mt-4">
            <h3 className="font-bold mb-1">Know someone who'd love this business?</h3>
            <p className="text-green-100 text-sm mb-4">Share your link and earn <strong>20 Local Bucks</strong> when they sign up.</p>
            <button onClick={copyShareLink} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${copied ? "bg-white text-green-700" : "bg-white/20 text-white hover:bg-white/30"}`}>
              {copied ? "✓ Copied!" : currentUserReferralCode ? "Copy your referral link" : "Copy link"}
            </button>
            {!currentUserId && <p className="text-green-200 text-xs text-center mt-2"><Link href="/signup" className="underline">Sign up</Link> to get your referral link</p>}
          </div>
        </div>

        {/* ── REVIEWS ───────────────────────────────────────────── */}
        <div id="reviews" ref={(el) => { sectionRefs.current.reviews = el; }} className="max-w-2xl mt-16 pt-8 border-t border-gray-100">
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

          {/* ── MOBILE INQUIRY FORM (shown below content on small screens) ── */}
          <div className="lg:hidden mt-10 border-t border-gray-100 pt-8">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-900 px-5 py-4">
                <h2 className="text-white font-black text-base leading-tight">{inquiryHeading}</h2>
                <p className="text-gray-400 text-xs mt-0.5">We'll get back to you as soon as possible.</p>
              </div>
              {sidebarDone ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-bold text-gray-900">Message Sent!</p>
                  <p className="text-gray-500 text-sm mt-1">{vendor.business_name} will be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={submitSidebarInquiry} className="px-5 py-4 space-y-3">
                  <input required value={sidebarName} onChange={(e) => setSidebarName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <input required type="email" value={sidebarEmail} onChange={(e) => setSidebarEmail(e.target.value)} placeholder="Email address" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <input value={sidebarPhone} onChange={(e) => setSidebarPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <textarea required value={sidebarMessage} onChange={(e) => setSidebarMessage(e.target.value)} rows={3} placeholder="How can we help you?" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                  <button type="submit" disabled={sidebarSubmitting} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-60">
                    {sidebarSubmitting ? "Sending…" : inquirySubmitLabel}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR INQUIRY FORM ──────────────────────────────── */}
        <aside className="hidden lg:block w-80 shrink-0 sticky top-20">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gray-900 px-6 py-5">
              <h2 className="text-white font-black text-lg leading-tight">{inquiryHeading}</h2>
              <p className="text-gray-400 text-sm mt-1">We'll get back to you as soon as possible.</p>
            </div>
            {sidebarDone ? (
              <div className="px-6 py-10 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-bold text-gray-900 text-lg">Message Sent!</p>
                <p className="text-gray-500 text-sm mt-1">{vendor.business_name} will be in touch soon.</p>
                <button onClick={() => { setSidebarDone(false); setSidebarName(""); setSidebarEmail(""); setSidebarPhone(""); setSidebarMessage(""); }} className="mt-5 text-sm text-gray-400 hover:text-gray-600 underline">Send another</button>
              </div>
            ) : (
              <form onSubmit={submitSidebarInquiry} className="px-6 py-5 space-y-3">
                <input
                  required value={sidebarName} onChange={(e) => setSidebarName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  required type="email" value={sidebarEmail} onChange={(e) => setSidebarEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  value={sidebarPhone} onChange={(e) => setSidebarPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <textarea
                  required value={sidebarMessage} onChange={(e) => setSidebarMessage(e.target.value)}
                  rows={4} placeholder="How can we help you?"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
                <button
                  type="submit" disabled={sidebarSubmitting}
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-60"
                >
                  {sidebarSubmitting ? "Sending…" : inquirySubmitLabel}
                </button>
                <p className="text-center text-xs text-gray-400">Your info goes directly to {vendor.business_name}</p>
              </form>
            )}
          </div>

          {/* Quick contact links below the form */}
          {(vendor.phone || externalWebsite) && (
            <div className="mt-4 space-y-2">
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors">
                  <span className="text-lg">📞</span> {vendor.phone}
                </a>
              )}
              {externalWebsite && (
                <a href={externalWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors">
                  <span className="text-lg">🌐</span> {externalWebsite.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              )}
            </div>
          )}
        </aside>
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

/* ─── LISTING HELPERS (shared by the card and the detail popup) ────── */
const TYPE_ICON: Record<string, string> = { product: "📦", service: "🔧", restaurant: "🍽️", event: "🎉", rental: "🏠", thrift: "🏷️", housing_sale: "🏠", housing_rent: "🏡" };

function parseHousing(listing: Listing): any | null {
  if (listing.type !== "housing_sale" && listing.type !== "housing_rent") return null;
  try { const t = listing.tags?.find((t) => t.startsWith("__housing:")); return t ? JSON.parse(t.replace("__housing:", "")) : null; } catch { return null; }
}

function parseThrift(listing: Listing): { address: string | null; openDays: { day: string; open: string; close: string }[] } | null {
  if (listing.type !== "thrift") return null;
  try {
    const t = listing.tags?.find((t) => t.startsWith("__hours:")); let hours: any[] = [];
    if (t) hours = JSON.parse(t.replace("__hours:", ""));
    return { address: listing.price_label, openDays: hours.filter((h) => !h.closed && h.open && h.close) };
  } catch { return null; }
}

function derivePriceLabel(listing: Listing): string | null {
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
function resolveListingCta(listing: Listing, vendorPhone: string | null, menuPdfUrl: string | null): { ctaLabel: string; ctaAction: ListingCtaAction | "message" } {
  const savedCta = isListingCtaType(listing.cta_type) ? listing.cta_type : null;
  if (savedCta && !(savedCta === "call" && !vendorPhone) && !(savedCta === "menu" && !menuPdfUrl)) {
    return { ctaLabel: LISTING_CTAS[savedCta].label, ctaAction: LISTING_CTAS[savedCta].action };
  }
  if (listing.type === "rental") return { ctaLabel: "Book Now", ctaAction: "book" };
  if (BUY_NOW_CATEGORIES.some((c) => listing.category?.includes(c.split(" ")[0]))) return { ctaLabel: "Buy Now", ctaAction: "buy" };
  if (vendorPhone) return { ctaLabel: "Call Now", ctaAction: "call" };
  return { ctaLabel: "Message", ctaAction: "message" };
}

/* ─── LISTING CARD ────────────────────────────────────────────────── */
function ListingCard({ listing, vendorName, vendorPhone, menuPdfUrl, onOpen, onBook, onBuy, onMessage }: {
  listing: Listing; vendorName: string; vendorPhone: string | null; menuPdfUrl: string | null;
  onOpen: () => void; onBook: () => void; onBuy: () => void; onMessage: () => void;
}) {
  const housingData = parseHousing(listing);
  const thriftData = parseThrift(listing);
  const priceLabel = derivePriceLabel(listing);
  const { ctaLabel, ctaAction } = resolveListingCta(listing, vendorPhone, menuPdfUrl);

  // The green CTA acts directly; clicking anywhere else on the card opens the
  // detail popup (photos, full description, sticky action bar).
  function runCta() {
    if (ctaAction === "book") onBook();
    else if (ctaAction === "buy") onBuy();
    else if (ctaAction === "menu" && menuPdfUrl) window.open(menuPdfUrl, "_blank", "noopener,noreferrer");
    else onMessage();
  }

  // Category chip text
  const chipText = (listing.tags ?? []).filter((t) => !t.startsWith("__"))[0]?.toUpperCase()
    ?? listing.category?.toUpperCase()
    ?? listing.type.replace(/_/g, " ").toUpperCase();

  const hasImage = !!listing.images?.[0];

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer aspect-[4/3]"
      onClick={onOpen}
    >
      {/* Full-bleed image */}
      {hasImage
        ? <img src={listing.images[0]} alt={listing.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        : <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-6xl">{TYPE_ICON[listing.type] ?? "📦"}</div>}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      {/* Out of stock badge */}
      {listing.quantity === 0 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <span className="bg-red-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">Out of Stock</span>
        </div>
      )}

      {/* Top chips */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <span className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full border border-white/20">
          {TYPE_ICON[listing.type] ?? "📦"} {chipText}
        </span>
        {listing.is_featured && <span className="bg-amber-400 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full">⭐ Featured</span>}
      </div>

      {/* Bottom overlay content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <h3 className="text-white font-black text-base sm:text-xl leading-tight mb-1 drop-shadow line-clamp-2">{listing.title}</h3>

        {/* Housing quick stats */}
        {housingData && (
          <p className="text-white/70 text-xs mb-1.5">
            {[housingData.bedrooms && `${housingData.bedrooms} bd`, housingData.bathrooms && `${housingData.bathrooms} ba`, housingData.sqft && `${housingData.sqft} sqft`].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Thrift hours */}
        {thriftData?.openDays.length ? (
          <p className="text-white/70 text-xs mb-1.5">{thriftData.openDays.slice(0, 2).map((h) => `${h.day.slice(0,3)} ${h.open}–${h.close}`).join(" · ")}</p>
        ) : null}

        <div className="flex items-end justify-between gap-3 mt-2">
          {/* Price */}
          {priceLabel && (
            <span className="text-white font-black text-lg drop-shadow">{priceLabel}{listing.condition ? <span className="text-white/60 text-xs font-normal ml-1.5 capitalize">{listing.condition}</span> : null}</span>
          )}

          {/* CTA — dial the phone for "Call Now", open the menu PDF for "View Menu", otherwise open the matching form */}
          {ctaAction === "call" && vendorPhone ? (
            <a
              href={`tel:${vendorPhone.replace(/[^\d+]/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-black tracking-wider uppercase transition-colors shrink-0"
            >
              {ctaLabel} <span className="text-base">→</span>
            </a>
          ) : ctaAction === "menu" && menuPdfUrl ? (
            <a
              href={menuPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-black tracking-wider uppercase transition-colors shrink-0"
            >
              {ctaLabel} <span className="text-base">→</span>
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); runCta(); }}
              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-black tracking-wider uppercase transition-colors shrink-0"
            >
              {ctaLabel} <span className="text-base">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── LISTING DETAIL POPUP ────────────────────────────────────────── */
// Bottom sheet on mobile, centered dialog on desktop. Shows the full photo
// gallery and details with a sticky action bar that reuses the same CTA
// behavior as the card's green button.
function ListingDetailModal({ listing, vendorPhone, menuPdfUrl, onClose, onBook, onBuy, onMessage }: {
  listing: Listing; vendorPhone: string | null; menuPdfUrl: string | null;
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
