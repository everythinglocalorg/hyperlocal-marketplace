"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";
import RentalBookingModal from "@/components/rental/RentalBookingModal";
import BuyNowModal from "@/components/BuyNowModal";
import MakeOfferModal from "@/components/MakeOfferModal";
import ShareQrModal, { QrGlyph, type ShareSlide } from "@/components/ShareQrModal";
import { BRAND_ORIGIN } from "@/lib/domains";
import MessageModal from "@/components/MessageModal";
import WelcomeGateModal from "@/components/WelcomeGateModal";
import FollowButton from "@/components/FollowButton";
import Top8Button from "@/components/Top8Button";
import { useFavorites } from "@/lib/favorites";
import ListingDetailModal, { TYPE_ICON, parseHousing, parseThrift, derivePriceLabel, resolveListingCta } from "@/components/ListingDetailModal";
import ReferModal from "@/components/ReferModal";
import LeafletMap from "@/components/LeafletMap";
import LocalTop8Badge from "@/components/LocalTop8Badge";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";
import { StoreTheme, normalizeTheme, fontStack, textScalePx, buildGoogleFontsHref } from "@/lib/fonts";
import { renderRichText } from "@/lib/richtext";
import { isFoodTruck, normalizeFoodTruck, isLive, upcomingStops, TRUCK_STATUS_META, externalOrderUrl } from "@/lib/foodtruck";
import FoodOrderModal from "@/components/FoodOrderModal";

type BlockKind = "heading" | "text" | "image" | "image-text" | "quote" | "button";
type PageBlock = {
  id: string;
  image_url: string;
  text: string;
  font_size: "sm" | "base" | "lg" | "xl" | "2xl";
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  layout: "image-left" | "image-right" | "image-top" | "image-only";
  kind?: BlockKind;              // absent → legacy image+text block (rendered via layout)
  eyebrow?: string;              // small label above a heading
  attribution?: string;         // quote author
  href?: string;                // button link
  object_position?: number;     // 0–100 vertical focal point for images
  fit?: "cover" | "contain";    // image fit
};

type Vendor = {
  id: string; user_id?: string | null; business_name: string; slug: string; description: string | null;
  category: string; city: string; state: string; zip_code: string;
  address: string | null; phone: string | null; website: string | null;
  logo_url: string | null; banner_url: string | null; tier: string;
  is_verified: boolean; is_claimed: boolean; rating: number; review_count: number;
  local_bucks_earned: number; service_radius_miles: number;
  latitude?: number | null; longitude?: number | null;
  service_locations?: string[] | null;
  banner_position?: number | null;
  banner_zoom?: number | null;
  page_blocks?: PageBlock[] | null;
  menu_pdf_url?: string | null;
  cta_button?: { action?: "call" | "estimate" | "order"; url?: string } | null;
  theme?: StoreTheme | null;
  stripe_connect_enabled?: boolean | null;
  pickup_info?: string | null;
  drop_info?: string | null;
  food_truck?: unknown;
};

// Category cover photos (hand-verified Unsplash) — used as the hero cover when
// a vendor has no banner and no product photo yet. Darkened by a gradient.
const UNSPLASH = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=60&auto=format&fit=crop`;
const CATEGORY_COVERS: Record<string, string> = {
  "Products": UNSPLASH("1441986300917-64674bd600d8"),
  "Thrift Sales": UNSPLASH("1489274495757-95c7c837b101"),
  "Services & Trades": UNSPLASH("1504307651254-35680f356dfd"),
  "Restaurants & Food": UNSPLASH("1517248135467-4c7edcad34c4"),
  "Events & Rentals": UNSPLASH("1519671482749-fd09be7ccebf"),
  "Health & Beauty": UNSPLASH("1560066984-138dadb4c035"),
  "Home & Garden": UNSPLASH("1416879595882-3373a0480b5b"),
  "Clothing & Accessories": UNSPLASH("1445205170230-053b83016050"),
  "Arts & Crafts": UNSPLASH("1452860606245-08befc0ff44b"),
  "Sports & Outdoors": UNSPLASH("1461896836934-ffe607ba8211"),
  "Auto & Transportation": UNSPLASH("1487754180451-c456f719a1fc"),
  "Pet Services": UNSPLASH("1450778869180-41d0601e046e"),
  "Childcare & Education": UNSPLASH("1503676260728-1c00da094a0b"),
  "Housing & Rentals": UNSPLASH("1560518883-ce09059eeffa"),
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
  waiver_body?: string | null; rental_mode?: string | null;
  rental_quantity?: number | null; rental_buffer_hours?: number | null;
  fareharbor_shortname?: string | null; fareharbor_flow?: string | null;
  rental_deposit_type?: string | null; rental_deposit_value?: number | null;
  cta_type?: string | null; listing_category_id?: string | null;
};

type ListingCategory = { id: string; name: string; position: number };

type Review = {
  id: string; rating: number; comment: string | null; created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

// Scroll-nav sections; "menu" is only rendered when vendor.menu_pdf_url exists.
type Section = "about" | "services" | "menu" | "reviews";

interface Props {
  vendor: Vendor; listings: Listing[]; listingCategories?: ListingCategory[]; reviews: Review[];
  currentUserId: string | null; currentUserReferralCode: string | null; inboundRefCode: string | null;
  localTop8Rank?: number | null;
  isFoundingMember?: boolean;
}

export default function VendorProfileClient({ vendor, listings, listingCategories = [], reviews, currentUserId, currentUserReferralCode, inboundRefCode, localTop8Rank, isFoundingMember }: Props) {
  const supabase = createClient();

  // Store typography (fonts + text size) chosen in Store Settings → vendors.theme.
  // Only applied when the vendor actually set a theme, so untouched stores keep
  // their current editorial defaults (serif headings, system body).
  const rawTheme = vendor.theme;
  const hasCustomTheme = !!rawTheme && typeof rawTheme === "object" && Object.keys(rawTheme).length > 0;
  const theme = normalizeTheme(rawTheme);
  const fontsHref = hasCustomTheme ? buildGoogleFontsHref([theme.heading_font, theme.body_font]) : null;
  const storeStyle = hasCustomTheme
    ? ({ fontFamily: fontStack(theme.body_font), fontSize: textScalePx(theme.text_scale), ["--sf-heading" as string]: fontStack(theme.heading_font) } as React.CSSProperties)
    : undefined;
  const headingStyle = hasCustomTheme ? ({ fontFamily: "var(--sf-heading)" } as React.CSSProperties) : undefined;
  const favorites = useFavorites();
  const [activeSection, setActiveSection] = useState<Section>("services");
  const [activeProductCat, setActiveProductCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // "menu" only appears when the vendor has a saved menu PDF. Restaurants get
  // the menu up top (right after About), since it's the main thing diners want.
  const isRestaurant = vendor.category === "Restaurants & Food";
  const navSections: Section[] = vendor.menu_pdf_url
    ? (isRestaurant ? ["about", "menu", "services", "reviews"] : ["about", "services", "menu", "reviews"])
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
  const [offerListing, setOfferListing] = useState<Listing | null>(null);
  const [estimateListing, setEstimateListing] = useState<Listing | null>(null);
  const [messageListing, setMessageListing] = useState<Listing | null>(null);
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [showRefer, setShowRefer] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null; email?: string; role?: string | null } | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [citySlug, setCitySlug] = useState(DEFAULT_CITY_SLUG);
  const siteMenuRef = useRef<HTMLDivElement>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  // Soft signup gate: guests must create a profile before high-intent actions.
  const [gateNext, setGateNext] = useState<string | null>(null);
  function requireAccount(): boolean {
    if (!currentUserId) { setGateNext(`/vendors/${vendor.slug}`); return true; }
    return false;
  }
  // Deep link from the food-truck board's "Start Order" (internal ordering).
  // External-link trucks are sent straight to their URL from the board instead.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("order") !== "1") return;
    const ft = isFoodTruck(vendor.category) ? normalizeFoodTruck(vendor.food_truck) : null;
    if (ft && ft.status === "open" && !externalOrderUrl(ft)) {
      if (!requireAccount()) setShowOrderModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // (imported vendors default their website to our own domain /vendors/…).
  const externalWebsite = vendor.website && !/everythinglocal\.(shop|org)/i.test(vendor.website) ? vendor.website : null;

  // Service-based businesses request estimates; product/food/retail businesses "get in touch".
  const isServiceBased = SERVICE_CATEGORIES.has(vendor.category);
  const inquiryHeading = isServiceBased ? "Request A Free Estimate" : "Get in Touch";
  const inquirySubmitLabel = isServiceBased ? "Request Free Estimate →" : "Send Message →";
  // Effective CTA: food trucks default to "order" (their primary action is
  // ordering, with Message as the secondary option); service businesses fall
  // back to "estimate"; everyone else has no default primary CTA.
  const effectiveCta = ctaAction ?? (isFoodTruck(vendor.category) ? "order" : isServiceBased ? "estimate" : null);

  // Hero cover: the vendor's own banner if they set one, otherwise default to
  // their first product/listing photo, else fall back to a branded gradient.
  const heroCover =
    (vendor.banner_url && vendor.banner_url !== vendor.logo_url)
      ? vendor.banner_url
      : (listings.find((l) => l.images?.[0])?.images[0]
          ?? CATEGORY_COVERS[vendor.category]
          ?? null);

  // Sidebar inquiry form state
  const [sidebarName, setSidebarName] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [sidebarPhone, setSidebarPhone] = useState("");
  const [sidebarMessage, setSidebarMessage] = useState("");
  const [sidebarSubmitting, setSidebarSubmitting] = useState(false);
  const [sidebarDone, setSidebarDone] = useState(false);

  async function submitSidebarInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (requireAccount()) return;
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
      inquiry_type: effectiveCta ?? "cta",
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
        inquiryType: effectiveCta ?? "cta",
      }),
    }).catch(() => {});
    setCtaFormSubmitting(false); setCtaFormDone(true);
  }

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await createClient().from("profiles").select("id, full_name, role").eq("id", user.id).single();
      if (profile) setCurrentUser({ ...profile, email: user.email });
    });
  }, []);

  // Site menu (hamburger) — city for local links + close on outside click
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_CITY_KEY);
      if (saved) setCitySlug(saved);
    }
  }, []);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (siteMenuRef.current && !siteMenuRef.current.contains(e.target as Node)) setSiteMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // The vendor owner viewing their own store shouldn't inflate their stats.
  const isOwner = !!currentUserId && currentUserId === vendor.user_id;

  // Share sheet (QR wallet). GlobalHeader is hidden on storefronts, so the
  // storefront's own menu carries it. The business slide only appears when the
  // viewer owns THIS store — otherwise they just get their own refer/profile.
  const shareSlides: ShareSlide[] = currentUserId
    ? [
        ...(currentUserReferralCode
          ? [{
              key: "referral",
              label: "Refer",
              title: "Refer & earn",
              blurb: "Earn 20 Local Bucks when someone joins with your link — they get 10.",
              link: `${BRAND_ORIGIN}/signup?ref=${currentUserReferralCode}`,
            }]
          : []),
        {
          key: "profile",
          label: "Profile",
          title: "My profile",
          blurb: "Your public Everything Local profile.",
          link: `${BRAND_ORIGIN}/u/${currentUserId}`,
        },
        ...(isOwner
          ? [{
              key: "business",
              label: "Business",
              title: vendor.business_name,
              blurb: "Your storefront — download and print it for your counter.",
              link: `${BRAND_ORIGIN}/vendors/${vendor.slug}${currentUserReferralCode ? `?ref=${currentUserReferralCode}` : ""}`,
              downloadName: `${vendor.slug}-storefront-qr`,
            }]
          : []),
      ]
    : [];

  // Track a store-page visit once per browser session (this is "Store Visits").
  // Per-listing views are tracked separately, only when an item is actually opened.
  useEffect(() => {
    if (isOwner) return;
    const key = `viewed_vendor_${vendor.id}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_vendor_profile_views", { vendor_id_in: vendor.id }).then(() => {});
  }, [supabase, vendor.id, isOwner]);

  // Count a listing view only when a visitor actually opens that item's detail,
  // once per session per listing (not the owner, not on every store-page load).
  function openDetail(listing: Listing) {
    setDetailListing(listing);
    if (isOwner || typeof window === "undefined") return;
    const key = `viewed_listing_${listing.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_listing_views", { listing_id_in: listing.id }).then(() => {});
  }

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
    // If this vendor uses FareHarbor, hand off to their Lightframe embed
    // (FareHarbor handles its own calendar, payment, and waivers). Otherwise
    // use the native rental flow.
    if (listing.fareharbor_shortname) {
      openFareHarbor(listing);
      return;
    }
    const { data: durations } = await supabase.from("rental_durations").select("*").eq("listing_id", listing.id).order("hours");
    setBookingDurations(durations ?? []);
    setBookingListing(listing);
  }

  function openFareHarbor(listing: Listing) {
    const shortname = listing.fareharbor_shortname!;
    const flow = listing.fareharbor_flow || undefined;
    const doOpen = () => {
      const w = window as unknown as { FH?: { open: (o: Record<string, unknown>) => void } };
      if (w.FH && typeof w.FH.open === "function") {
        w.FH.open({ shortname, fallback: "simple", ...(flow ? { flow: Number(flow) } : {}) });
      } else {
        const url = `https://fareharbor.com/embeds/book/${shortname}/${flow ? `?flow=${flow}&` : "?"}full-items=yes`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };
    if (document.getElementById("fh-embed-script")) { doOpen(); return; }
    const s = document.createElement("script");
    s.id = "fh-embed-script";
    s.src = "https://fareharbor.com/embeds/api/v1/?autolightframe=yes";
    s.async = true;
    s.onload = doOpen;
    document.body.appendChild(s);
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
    <div className="space-y-1">
      {pageBlocks.map((block) => {
        const alignClass = block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left";
        const sizeClass = FONT_SIZE_MAP[block.font_size] ?? "text-base";
        const textClass = `${sizeClass} ${block.bold ? "font-bold" : "font-normal"} ${alignClass} leading-relaxed`;
        const imgStyle = { objectPosition: `center ${block.object_position ?? 50}%` } as React.CSSProperties;
        const fitClass = block.fit === "contain" ? "object-contain bg-gray-50" : "object-cover";
        const headingFam = hasCustomTheme ? { fontFamily: "var(--sf-heading)" } : undefined;
        const kind: BlockKind = block.kind ?? (block.layout === "image-only" ? "image" : "image-text");

        if (kind === "heading") {
          return (
            <div key={block.id} className={`py-6 ${alignClass}`}>
              {block.eyebrow && <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-2">{block.eyebrow}</p>}
              <h3 className={`${sizeClass === "text-base" ? "text-3xl" : sizeClass} font-black leading-tight`} style={{ color: block.color, ...headingFam }}>{block.text}</h3>
            </div>
          );
        }

        if (kind === "quote") {
          return (
            <div key={block.id} className="py-6">
              <blockquote className="border-l-4 border-gray-900 pl-5">
                <p className="italic text-xl leading-relaxed" style={{ color: block.color, ...(headingFam ?? { fontFamily: "Georgia, serif" }) }}>{block.text}</p>
                {block.attribution && <footer className="mt-2 text-sm text-gray-500">— {block.attribution}</footer>}
              </blockquote>
            </div>
          );
        }

        if (kind === "button") {
          return (
            <div key={block.id} className={`py-5 ${alignClass}`}>
              <a href={block.href || "#"} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors">
                {block.text || "Learn more"} <span aria-hidden="true">→</span>
              </a>
            </div>
          );
        }

        if (kind === "text") {
          return (
            <div key={block.id} className={`py-4 ${textClass}`} style={{ color: block.color }}>{renderRichText(block.text)}</div>
          );
        }

        if (kind === "image") {
          return (
            <div key={block.id} className="w-full py-4">
              {block.image_url && <img src={block.image_url} alt="" style={imgStyle} className={`w-full max-h-[520px] ${fitClass} rounded-2xl`} />}
              {block.text && <div className={`mt-3 ${textClass}`} style={{ color: block.color }}>{renderRichText(block.text)}</div>}
            </div>
          );
        }

        if (block.layout === "image-top") {
          return (
            <div key={block.id} className="py-6">
              {block.image_url && <img src={block.image_url} alt="" style={imgStyle} className={`w-full rounded-2xl max-h-96 ${fitClass} mb-5`} />}
              {block.text && <div className={textClass} style={{ color: block.color }}>{renderRichText(block.text)}</div>}
            </div>
          );
        }

        const isLeft = block.layout !== "image-right";
        return (
          <div key={block.id} className={`py-8 flex flex-col ${isLeft ? "sm:flex-row" : "sm:flex-row-reverse"} gap-6 sm:gap-10 items-center`}>
            {block.image_url && (
              <div className="w-full sm:w-1/2 shrink-0">
                <img src={block.image_url} alt="" style={imgStyle} className={`w-full rounded-2xl ${fitClass} max-h-80 sm:max-h-96`} />
              </div>
            )}
            {block.text && (
              <div className={`flex-1 ${textClass}`} style={{ color: block.color }}>{renderRichText(block.text)}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Menu block — placed after About for restaurants, otherwise after Services.
  // Just a button that opens the menu PDF in a new browser tab (no embedded viewer).
  const menuSection = vendor.menu_pdf_url ? (
    <div id="menu" ref={(el) => { sectionRefs.current.menu = el; }} className="mt-16 pt-8 border-t border-gray-100">
      <p className="text-center text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">The Menu</p>
      <a
        href={vendor.menu_pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-md mx-auto flex items-center justify-center gap-2 border-2 border-gray-900 text-gray-900 tracking-wide font-bold px-6 py-4 rounded-xl hover:bg-gray-900 hover:text-white transition-colors"
      >
        VIEW FULL MENU <span aria-hidden="true">↗</span>
      </a>
    </div>
  ) : null;

  // Food-truck live status + weekly schedule (only for Food Trucks vendors).
  const truckIsFoodTruck = isFoodTruck(vendor.category);
  const foodTruck = truckIsFoodTruck ? normalizeFoodTruck(vendor.food_truck) : null;
  const foodTruckSection = foodTruck ? (() => {
    const live = isLive(foodTruck);
    const meta = TRUCK_STATUS_META[foodTruck.status];
    const upcoming = upcomingStops(foodTruck);
    const spot = foodTruck.spot;
    const hasPin = live && spot.lat != null && spot.lng != null;
    return (
      <div className="mb-10">
        <div className={`rounded-2xl border p-5 ${live ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: meta.dot }} />
              <span className={`font-black text-lg ${meta.text}`}>{meta.label}</span>
              {live && spot.name && <span className="text-gray-600 text-sm">· {spot.name}{spot.until ? ` · until ${spot.until}` : ""}</span>}
            </div>
            {hasPin && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors">Get directions →</a>
            )}
          </div>
          {foodTruck.status === "open" && (
            externalOrderUrl(foodTruck) ? (
              <a href={externalOrderUrl(foodTruck) as string} target="_blank" rel="noopener noreferrer"
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-green-700 transition-colors">
                🧾 Order now ↗
              </a>
            ) : (
              <button onClick={() => { if (requireAccount()) return; setShowOrderModal(true); }}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-green-700 transition-colors">
                🧾 Order for pickup
              </button>
            )
          )}
          {!live && upcoming.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">Next: {upcoming[0].day} · {upcoming[0].label}{upcoming[0].start ? ` · ${upcoming[0].start}${upcoming[0].end ? `–${upcoming[0].end}` : ""}` : ""}</p>
          )}
          {hasPin && (
            <div className="mt-4 rounded-xl overflow-hidden">
              <LeafletMap markers={[{ lat: spot.lat as number, lng: spot.lng as number, title: vendor.business_name, subtitle: spot.name || undefined }]} height={200} zoom={15} />
            </div>
          )}
        </div>
        {foodTruck.schedule.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-3">This week</p>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-semibold text-gray-800 w-14 shrink-0">{s.day}</span>
                  <span className="flex-1 text-gray-700 min-w-0 truncate">{s.label}</span>
                  <span className="text-gray-500 shrink-0">{s.start}{s.end ? `–${s.end}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  })() : null;

  return (<>
    {/* Modals */}
    {messageListing && <MessageModal listing={{ id: messageListing.id, title: messageListing.title }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} onClose={() => setMessageListing(null)} />}
    <WelcomeGateModal open={!!gateNext} next={gateNext ?? undefined} onClose={() => setGateNext(null)} />
    {showOrderModal && <FoodOrderModal vendor={{ id: vendor.id, business_name: vendor.business_name }} listings={listings.map((l) => ({ id: l.id, title: l.title, price: l.price }))} currentUser={currentUser} onClose={() => setShowOrderModal(false)} />}

    {/* Sticky mobile CTA bar — clean icon+label nav on the left, primary action pill on the right */}
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-6">
        {isRestaurant && vendor.menu_pdf_url && (
          <a href={vendor.menu_pdf_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
            <span className="text-[11px] font-medium">Menu</span>
          </a>
        )}
        {vendor.phone && (
          <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
            <span className="text-[11px] font-medium">Call</span>
          </a>
        )}
        {effectiveCta && (
          <button onClick={() => { if (requireAccount()) return; setShowMessageModal(true); }} className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            <span className="text-[11px] font-medium">Message</span>
          </button>
        )}
      </div>
      <button
        onClick={() => {
          // Food trucks: the primary action is ordering (external link if set,
          // otherwise the built-in pickup order modal). Message is the secondary.
          if (truckIsFoodTruck) {
            const ext = foodTruck ? externalOrderUrl(foodTruck) : null;
            if (ext) { window.open(ext, "_blank", "noopener,noreferrer"); return; }
            if (requireAccount()) return;
            setShowOrderModal(true);
            return;
          }
          if (effectiveCta === "order" && ctaOrderUrl) { window.open(ctaOrderUrl, "_blank", "noopener,noreferrer"); return; }
          if (requireAccount()) return;
          if (effectiveCta === "estimate" || effectiveCta === "order") setShowCtaForm(true); else setShowMessageModal(true);
        }}
        className="shrink-0 bg-gray-900 text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-gray-800 transition-colors"
      >
        {effectiveCta ? CTA_LABELS[effectiveCta] : "Message"}
      </button>
    </div>
    {showMessageModal && <MessageModal listing={{ id: vendor.id, title: `Contact ${vendor.business_name}` }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} onClose={() => setShowMessageModal(false)} />}

    {/* CTA built-in form modal */}
    {showCtaForm && (effectiveCta === "estimate" || effectiveCta === "order") && (
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
                <h3 className="text-lg font-bold text-gray-900">{effectiveCta ? CTA_LABELS[effectiveCta] : "Contact Us"}</h3>
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
    {offerListing && <MakeOfferModal listing={{ id: offerListing.id, title: offerListing.title, price: offerListing.price }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} onClose={() => setOfferListing(null)} />}
    {shareOpen && shareSlides.length > 0 && <ShareQrModal slides={shareSlides} onClose={() => setShareOpen(false)} />}
    {estimateListing && <BuyNowModal listing={{ id: estimateListing.id, title: estimateListing.title, price: estimateListing.price, price_label: estimateListing.price_label }} vendor={{ id: vendor.id, business_name: vendor.business_name }} currentUser={currentUser} inquiryType="estimate" onClose={() => setEstimateListing(null)} />}
    {showRefer && <ReferModal vendorId={vendor.id} vendorName={vendor.business_name} currentUserId={currentUserId} onClose={() => setShowRefer(false)} />}
    {bookingListing && <RentalBookingModal listing={{ id: bookingListing.id, title: bookingListing.title, price: bookingListing.price, waiver_url: bookingListing.waiver_url, waiver_filename: bookingListing.waiver_filename, waiver_body: bookingListing.waiver_body, rental_mode: bookingListing.rental_mode, rental_quantity: bookingListing.rental_quantity, rental_buffer_hours: bookingListing.rental_buffer_hours, rental_deposit_type: bookingListing.rental_deposit_type, rental_deposit_value: bookingListing.rental_deposit_value }} kind={(bookingListing.type === "rental" || bookingListing.type === "housing_rent" || bookingListing.cta_type === "rent") ? "rental" : "service"} vendor={{ id: vendor.id, business_name: vendor.business_name }} durations={bookingDurations} currentUser={currentUser} onClose={() => setBookingListing(null)} />}

    {/* Listing detail popup — full photos/details; its sticky action bar reuses the same CTA handlers */}
    {detailListing && (
      <ListingDetailModal
        listing={detailListing}
        vendorPhone={vendor.phone}
        menuPdfUrl={vendor.menu_pdf_url ?? null}
        cartVendor={{ id: vendor.id, name: vendor.business_name, slug: vendor.slug, pickupInfo: vendor.pickup_info, dropInfo: vendor.drop_info }}
        paymentsEnabled={vendor.stripe_connect_enabled ?? false}
        onClose={() => setDetailListing(null)}
        onBook={() => { if (requireAccount()) { setDetailListing(null); return; } const l = detailListing; setDetailListing(null); openBooking(l); }}
        onBuy={() => { if (requireAccount()) { setDetailListing(null); return; } const l = detailListing; setDetailListing(null); trackClick(l.id); setBuyListing(l); }}
        onOrder={() => { const l = detailListing; if (!l) return; setDetailListing(null); trackClick(l.id); if (ctaOrderUrl) window.open(ctaOrderUrl, "_blank", "noopener,noreferrer"); else setBuyListing(l); }}
        onMakeOffer={() => { const l = detailListing; if (!l) return; setDetailListing(null); trackClick(l.id); setOfferListing(l); }}
        onEstimate={() => { if (requireAccount()) { setDetailListing(null); return; } const l = detailListing; setDetailListing(null); trackClick(l.id); setEstimateListing(l); }}
        onMessage={() => { if (requireAccount()) { setDetailListing(null); return; } const l = detailListing; setDetailListing(null); trackClick(l.id); setMessageListing(l); }}
      />
    )}

    {fontsHref && <link rel="stylesheet" href={fontsHref} />}
    <div className="min-h-screen bg-white" style={storeStyle}>

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

      {/* ── STICKY VENDOR NAV (unified storefront header; global header is hidden here) ── */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
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

          {/* Right actions + site menu */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {/* Contact/CTA — desktop only; mobile/tablet use the sticky bottom bar */}
            <div className="hidden lg:flex items-center gap-1.5">
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg px-3 py-2 font-medium">
                  📞 {vendor.phone}
                </a>
              )}
              <button
                onClick={() => { if (requireAccount()) return; setShowMessageModal(true); }}
                className="text-sm border border-gray-200 text-gray-700 px-2.5 py-2 rounded-lg font-semibold hover:border-gray-400 transition-colors whitespace-nowrap"
              >
                💬 Message
              </button>
              {truckIsFoodTruck ? (
                foodTruck && externalOrderUrl(foodTruck) ? (
                  <a href={externalOrderUrl(foodTruck) as string} target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                    Order Now →
                  </a>
                ) : (
                  <button onClick={() => { if (requireAccount()) return; setShowOrderModal(true); }} className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                    Order Now →
                  </button>
                )
              ) : ctaAction && (
                ctaAction === "call" && vendor.phone ? (
                  <a href={`tel:${vendor.phone}`} className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                    {CTA_LABELS[ctaAction]} →
                  </a>
                ) : ctaAction === "order" && ctaOrderUrl ? (
                  <a href={ctaOrderUrl} target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                    {CTA_LABELS[ctaAction]} →
                  </a>
                ) : ctaAction !== "call" ? (
                  <button onClick={() => { if (requireAccount()) return; setShowCtaForm(true); }} className="bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1">
                    {CTA_LABELS[ctaAction]} →
                  </button>
                ) : null
              )}
            </div>

            {/* Site menu (☰) — replaces the full Everything Local bar on storefronts */}
            <div className="relative" ref={siteMenuRef}>
              <button onClick={() => setSiteMenuOpen((v) => !v)} aria-label="Site menu" aria-expanded={siteMenuOpen} className="p-2 -mr-1 text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>
              </button>
              {siteMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  <Link href="/" onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🏠 Home</Link>
                  <Link href="/search" onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🔍 Browse local</Link>
                  <Link href={`/community/${citySlug}`} onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🏘️ Local Loop</Link>
                  <Link href={`/jobs/${citySlug}`} onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">💼 Local Jobs</Link>
                  <Link href={`/explore/${citySlug}`} onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🌿 Explore</Link>
                  {shareSlides.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setShareOpen(true); setSiteMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                      >
                        <QrGlyph className="w-4 h-4 text-gray-700 shrink-0" /> Share
                      </button>
                    </>
                  )}
                  {currentUserId && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <Link href="/wishlist" onClick={() => setSiteMenuOpen(false)} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <span>💚 Wish List</span>
                        {favorites.wishlistCount > 0 && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold">{favorites.wishlistCount}</span>}
                      </Link>
                      <p className="px-4 pt-2 pb-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase">⭐ Your Top 8</p>
                      {favorites.top8.length > 0 ? (
                        favorites.top8.map((v) => (
                          <Link key={v.vendorId} href={`/vendors/${v.slug}`} onClick={() => setSiteMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {v.logoUrl ? <img src={v.logoUrl} alt="" className="w-full h-full object-contain" /> : "🏪"}
                            </span>
                            <span className="truncate">{v.name}</span>
                          </Link>
                        ))
                      ) : (
                        <p className="px-4 pb-2 text-xs text-gray-400">Tap “Add to Top 8” on a business to save it here.</p>
                      )}
                    </>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  {currentUserId ? (
                    <Link href={currentUser?.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"} onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors">Dashboard →</Link>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Log in</Link>
                      <Link href="/signup" onClick={() => setSiteMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors">Sign up free</Link>
                    </>
                  )}
                </div>
              )}
            </div>
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

      {/* ── BUSINESS HERO ─────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        {/* Editorial cover — the business name sits over the image for a high-end feel */}
        <div className="relative h-52 sm:h-72 overflow-hidden bg-gradient-to-br from-green-600 to-emerald-700">
          {heroCover && (
            <img src={heroCover} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `center ${vendor.banner_position ?? 50}%` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <span className="absolute top-4 left-4 text-[11px] font-bold tracking-[0.2em] text-white/90 uppercase">
            {vendor.category}
          </span>
          {/* Title block over the cover: logo + name + rating */}
          <div className="absolute inset-x-0 bottom-0">
            <div className="max-w-6xl mx-auto px-4 pb-5 flex items-end gap-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
                {vendor.logo_url
                  ? <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-contain" />
                  : <span className="font-black text-2xl text-green-600">{vendor.business_name[0]}</span>}
              </div>
              <div className="min-w-0 pb-0.5">
                <h1 className="font-serif text-2xl sm:text-4xl font-black text-white leading-tight drop-shadow" style={headingStyle}>{vendor.business_name}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-white/90 flex-wrap">
                  <span className="font-bold">★ {(vendor.rating ?? 5).toFixed(1)}</span>
                  <span className="text-white/70">{vendor.review_count > 0 ? `(${vendor.review_count} reviews)` : "New"}</span>
                  <span>·</span>
                  <span>{vendor.city}, {vendor.state}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-5">
          {/* Badges row — recognition pills grouped on their own line for prominence */}
          {(vendor.is_verified || localTop8Rank || isFoundingMember) && (
            <div className="flex items-center gap-2 flex-wrap">
              {vendor.is_verified && <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">✓ Verified local</span>}
              {localTop8Rank && <LocalTop8Badge rank={localTop8Rank} city={vendor.city} state={vendor.state} />}
              {isFoundingMember && <span title="One of the first businesses to launch on Everything Local" className="text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">🏅 Founding Member</span>}
            </div>
          )}

          {/* Follow — live follower count */}
          <div className="mt-4">
            <FollowButton targetType="vendor" targetId={vendor.id} />
          </div>

          {/* Trust points — clean icon + text, no bubbles */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
              Serves {vendor.city} + {vendor.service_radius_miles} mi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" /></svg>
              Locally owned
            </span>
            <button onClick={() => setShowRefer(true)} className="inline-flex items-center gap-1.5 font-semibold text-amber-600 hover:text-amber-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              Earn Local Bucks on referrals →
            </button>
          </div>

          {/* Obvious primary CTA — desktop only; mobile uses the sticky bottom bar */}
          <div className="hidden lg:flex flex-wrap gap-2 mt-4">
            {ctaAction === "call" && vendor.phone ? (
              <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
                📞 Call now →
              </a>
            ) : ctaAction === "order" && ctaOrderUrl ? (
              <a href={ctaOrderUrl} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
                {CTA_LABELS.order} →
              </a>
            ) : truckIsFoodTruck ? (
              foodTruck && externalOrderUrl(foodTruck) ? (
                <a href={externalOrderUrl(foodTruck) as string} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
                  Order Now →
                </a>
              ) : (
                <button
                  onClick={() => { if (requireAccount()) return; setShowOrderModal(true); }}
                  className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                >
                  Order Now →
                </button>
              )
            ) : effectiveCta ? (
              <button
                onClick={() => { if (requireAccount()) return; if (effectiveCta === "estimate" || effectiveCta === "order") setShowCtaForm(true); else setShowMessageModal(true); }}
                className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
              >
                {CTA_LABELS[effectiveCta]} →
              </button>
            ) : vendor.phone ? (
              /* No CTA set → Call is the primary green action */
              <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
                📞 Call now →
              </a>
            ) : (
              /* No CTA and no phone → Message is the primary green action */
              <button
                onClick={() => { if (requireAccount()) return; setShowMessageModal(true); }}
                className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
              >
                💬 Message →
              </button>
            )}
            {vendor.phone && ctaAction !== "call" && effectiveCta && (
              <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} className="border-2 border-gray-200 text-gray-800 font-bold px-6 py-3 rounded-xl hover:border-gray-400 transition-colors">
                📞 Call
              </a>
            )}
            {(effectiveCta || vendor.phone) && (
              <button
                onClick={() => { if (requireAccount()) return; setShowMessageModal(true); }}
                className="border-2 border-gray-200 text-gray-800 font-bold px-6 py-3 rounded-xl hover:border-gray-400 transition-colors"
              >
                💬 Message
              </button>
            )}
          </div>

          {/* Trust stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-base font-black text-gray-900">★ {(vendor.rating ?? 5).toFixed(1)}</p>
              <p className="text-[11px] text-gray-500">{vendor.review_count > 0 ? `${vendor.review_count} reviews` : "New business"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-base font-black text-gray-900">{vendor.service_radius_miles} mi</p>
              <p className="text-[11px] text-gray-500">Service area</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-base font-black text-gray-900">{listings.length}</p>
              <p className="text-[11px] text-gray-500">{listings.length === 1 ? "Listing" : "Listings"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-base font-black text-gray-900">📍</p>
              <p className="text-[11px] text-gray-500">Owned here</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 w-full">

        {/* ── ABOUT ─────────────────────────────────────────────── */}
        {foodTruckSection}

        <div id="about" ref={(el) => { sectionRefs.current.about = el; }} className="max-w-2xl mb-12">
          <h2 className="font-serif text-xl font-black text-gray-900 mb-3" style={headingStyle}>About {vendor.business_name}</h2>
          {vendor.description
            ? <p className="text-gray-600 leading-relaxed whitespace-pre-line">{vendor.description}</p>
            : <p className="text-gray-400">No description provided yet.</p>}
        </div>

        {/* Restaurants: menu up top, right after About */}
        {isRestaurant && menuSection}

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
                <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-5">{isRestaurant ? "Popular" : "Services & Products"}</p>

                {/* Vendor-defined product categories — filter nav over the grid */}
                {listingCategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6 border-b border-gray-100 pb-3">
                    <button
                      onClick={() => setActiveProductCat(null)}
                      className={`text-sm font-semibold transition-colors ${activeProductCat === null ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
                    >
                      All
                    </button>
                    {listingCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveProductCat(c.id)}
                        className={`text-sm font-semibold transition-colors ${activeProductCat === c.id ? "text-gray-900 border-b-2 border-gray-900 -mb-[13px] pb-[11px]" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Clean minimal product grid — square image + name; click opens the detail popup (Buy/Book/Message live there) */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-6">
                  {(activeProductCat ? orderedListings.filter((l) => l.listing_category_id === activeProductCat) : orderedListings).map((listing) => (
                    <button key={listing.id} onClick={() => openDetail(listing)} className="text-left group">
                      <div className="relative aspect-square rounded-xl bg-white border border-gray-100 overflow-hidden mb-2 flex items-center justify-center">
                        {listing.images?.[0]
                          ? <img src={listing.images[0]} alt={listing.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <span className="text-3xl text-gray-300">{TYPE_ICON[listing.type] ?? "📦"}</span>}
                        {listing.is_featured && (
                          <span className="absolute top-2 right-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{listing.title}</p>
                    </button>
                  ))}
                </div>

                {/* Photo content blocks */}
                {pageBlocks.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-gray-100">{renderPhotoBlocks()}</div>
                )}
              </>
            )}
        </div>

        {/* ── MENU (non-restaurants: after Services) ────────────── */}
        {!isRestaurant && menuSection}

        {/* ── REVIEWS ───────────────────────────────────────────── */}
        <div id="reviews" ref={(el) => { sectionRefs.current.reviews = el; }} className="max-w-2xl mt-16 pt-8 border-t border-gray-100">
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-5">Reviews</p>
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
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <p className="text-4xl font-black text-gray-900">{(vendor.rating ?? 5).toFixed(1)}</p>
                  <div className="flex justify-center mt-1">{stars(vendor.rating ?? 5, "text-base")}</div>
                  <p className="text-sm font-semibold text-gray-700 mt-3">New business</p>
                  <p className="text-sm text-gray-400 mt-0.5">No reviews yet — be the first to share your visit.</p>
                </div>
              )}
            </div>
        </div>

        {/* Top 8 favorite — save this business for quick access */}
        <div className="max-w-2xl mt-10 flex flex-wrap items-center gap-3">
          <Top8Button vendor={{ vendorId: vendor.id, name: vendor.business_name, slug: vendor.slug, logoUrl: vendor.logo_url }} />
          <span className="text-sm text-gray-400">Save {vendor.business_name} to your Top 8 for quick access.</span>
        </div>

        {/* ── CONTACT & LOCATION (bottom of page) ────────────────── */}
        <div className="max-w-2xl mt-16 pt-8 border-t border-gray-100 space-y-4">
          <h2 className="font-serif text-xl font-black text-gray-900" style={headingStyle}>Contact & Location</h2>
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
          {vendor.latitude != null && vendor.longitude != null && (
            <div className="mt-2">
              <LeafletMap
                markers={[{ lat: vendor.latitude, lng: vendor.longitude, title: vendor.business_name, subtitle: vendor.address ? `${vendor.address}, ${vendor.city}, ${vendor.state}` : `${vendor.city}, ${vendor.state}` }]}
                height={240}
              />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${vendor.latitude},${vendor.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-green-600 font-semibold hover:underline"
              >
                🧭 Get directions
              </a>
            </div>
          )}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white mt-4">
            <h3 className="font-bold mb-1">Know someone who'd love this business?</h3>
            <p className="text-green-100 text-sm mb-4">Share your link and earn <strong>20 Local Bucks</strong> when they sign up.</p>
            <button onClick={copyShareLink} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${copied ? "bg-white text-green-700" : "bg-white/20 text-white hover:bg-white/30"}`}>
              {copied ? "✓ Copied!" : currentUserReferralCode ? "Copy your referral link" : "Copy link"}
            </button>
            {!currentUserId && <p className="text-green-200 text-xs text-center mt-2"><Link href="/signup" className="underline">Sign up</Link> to get your referral link</p>}
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
        <Link href="/"><Logo size="sm" /></Link>
        {!currentUserId && (
          <p className="text-sm text-gray-400 mt-3">
            <Link href="/signup" className="text-green-600 font-semibold hover:underline">Create a free account</Link> to message, book, and earn Local Bucks.
          </p>
        )}
      </div>
      {/* Spacer so the sticky mobile CTA bar never covers the footer */}
      <div className="h-20 lg:hidden" />
    </div>
  </>);
}

/* ─── LISTING CARD ────────────────────────────────────────────────── */
function ListingCard({ listing, vendorName, vendorPhone, menuPdfUrl, onOpen, onBook, onBuy, onEstimate, onMessage }: {
  listing: Listing; vendorName: string; vendorPhone: string | null; menuPdfUrl: string | null;
  onOpen: () => void; onBook: () => void; onBuy: () => void; onEstimate: () => void; onMessage: () => void;
}) {
  const housingData = parseHousing(listing);
  const thriftData = parseThrift(listing);
  const priceLabel = derivePriceLabel(listing);
  const { ctaLabel, ctaAction } = resolveListingCta(listing, vendorPhone, menuPdfUrl);

  // Don't repeat the price label when it just restates the CTA button
  // (e.g. a "Free estimate" price label next to a "Free Estimate" button).
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const showPrice = !!priceLabel && norm(priceLabel) !== norm(ctaLabel);

  // The green CTA acts directly; clicking anywhere else on the card opens the
  // detail popup (photos, full description, sticky action bar).
  function runCta() {
    if (ctaAction === "book") onBook();
    else if (ctaAction === "buy") onBuy();
    else if (ctaAction === "estimate") onEstimate();
    else if (ctaAction === "menu") {
      // On the storefront itself: open the menu PDF if any, else the item detail.
      if (menuPdfUrl) window.open(menuPdfUrl, "_blank", "noopener,noreferrer");
      else onOpen();
    }
    else onMessage();
  }

  // Category chip text
  const chipText = (listing.tags ?? []).filter((t) => !t.startsWith("__"))[0]?.toUpperCase()
    ?? listing.category?.toUpperCase()
    ?? listing.type.replace(/_/g, " ").toUpperCase();

  const hasImage = !!listing.images?.[0];

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer bg-white border border-gray-100"
      onClick={onOpen}
    >
      {/* Photo — kept clean; only the CTA (and badges) sit on it */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {hasImage
          ? <img src={listing.images[0]} alt={listing.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-6xl">{TYPE_ICON[listing.type] ?? "📦"}</div>}

        {/* Soft bottom scrim so the CTA stays legible on any photo */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Out of stock badge */}
        {listing.quantity === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="bg-red-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">Out of Stock</span>
          </div>
        )}

        {/* Featured badge */}
        {listing.is_featured && (
          <span className="absolute top-3 right-3 z-10 bg-amber-400 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full">⭐ Featured</span>
        )}

        {/* CTA — stays on the photo. Dial for "Call Now", open menu for "View Menu", else the matching form */}
        <div className="absolute bottom-3 right-3 z-10">
          {ctaAction === "call" && vendorPhone ? (
            <a
              href={`tel:${vendorPhone.replace(/[^\d+]/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-black tracking-wide uppercase px-3.5 py-2 rounded-full shadow-lg shadow-black/25 transition-colors"
            >
              {ctaLabel} <span className="text-base">→</span>
            </a>
          ) : ctaAction === "menu" && menuPdfUrl ? (
            <a
              href={menuPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-black tracking-wide uppercase px-3.5 py-2 rounded-full shadow-lg shadow-black/25 transition-colors"
            >
              {ctaLabel} <span className="text-base">→</span>
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); runCta(); }}
              className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-black tracking-wide uppercase px-3.5 py-2 rounded-full shadow-lg shadow-black/25 transition-colors"
            >
              {ctaLabel} <span className="text-base">→</span>
            </button>
          )}
        </div>
      </div>

      {/* Below the photo — category bubble, title, price */}
      <div className="p-4">
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase">
          {TYPE_ICON[listing.type] ?? "📦"} {chipText}
        </span>
        <h3 className="text-gray-900 font-black text-base sm:text-lg leading-tight line-clamp-2 mt-2">{listing.title}</h3>

        {housingData && (
          <p className="text-gray-500 text-xs mt-1">
            {[housingData.bedrooms && `${housingData.bedrooms} bd`, housingData.bathrooms && `${housingData.bathrooms} ba`, housingData.sqft && `${housingData.sqft} sqft`].filter(Boolean).join(" · ")}
          </p>
        )}
        {thriftData?.openDays.length ? (
          <p className="text-gray-500 text-xs mt-1">{thriftData.openDays.slice(0, 2).map((h) => `${h.day.slice(0,3)} ${h.open}–${h.close}`).join(" · ")}</p>
        ) : null}
        {showPrice && (
          <p className="text-green-700 font-black text-lg mt-1.5">{priceLabel}{listing.condition ? <span className="text-gray-400 text-xs font-normal ml-1.5 capitalize">{listing.condition}</span> : null}</p>
        )}
      </div>
    </div>
  );
}

