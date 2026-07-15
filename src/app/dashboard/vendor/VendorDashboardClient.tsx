"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import RentalSetup from "@/components/rental/RentalSetup";
import { formatLocalBucks, formatPrice, slugify } from "@/lib/utils";
import PremiumGate from "@/components/vendor/PremiumGate";
import BoostModal from "@/components/BoostModal";
import CrmBoard from "@/components/vendor/CrmBoard";
import ProposalBuilder from "@/components/vendor/ProposalBuilder";
import EstimatorTools from "@/components/vendor/EstimatorTools";
import JobMetrics from "@/components/vendor/JobMetrics";
import CustomDomainPanel from "@/components/CustomDomainPanel";
import ProductCategoriesManager, { ListingCategory } from "@/components/vendor/ProductCategoriesManager";
import PlacesManager from "@/components/admin/PlacesManager";
import { LocalProPriceInline } from "@/components/LocalProPrice";
import { hasFeature, FeatureKey, featuresForTier, isPlusTier } from "@/lib/features";
import { LISTING_CTA_OPTIONS, ListingCtaType, isListingCtaType, defaultCtaForListingType } from "@/lib/cta";

type Tab = "overview" | "listings" | "analytics" | "bookings" | "rentals" | "offers" | "crm" | "referrals" | "store" | "notifications" | "messages" | "pagecontent" | "businesses" | "alllistings" | "allplaces" | "myplaces";

interface Props {
  vendor: {
    id: string;
    user_id: string;
    business_name: string;
    slug: string;
    tier: string;
    rating: number;
    review_count: number;
    local_bucks_earned: number;
    logo_url: string | null;
    banner_url: string | null;
    description: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    is_verified: boolean;
    category: string;
    city: string;
    state: string;
    page_blocks?: any[] | null;
    profile_views?: number | null;
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    menu_pdf_url?: string | null;
  };
  profile: { local_bucks: number; full_name: string | null; referral_code: string; email?: string | null; avatar_url: string | null; phone: string | null; is_admin?: boolean } | null;
  isPremium: boolean;
  features: Record<string, boolean>;
  activeListingCap: number | null;
  isAdmin: boolean;
  connectEnabled: boolean;
  connectAccountId: string | null;
  initialTab?: string;
}

type Listing = {
  id: string;
  title: string;
  type: string;
  price: number | null;
  price_label: string | null;
  condition: string | null;
  is_active: boolean;
  is_featured: boolean;
  view_count: number;
  click_count: number;
  quantity: number | null;
  images: string[];
  tags: string[];
  category: string;
  categories: string[];
  listing_category_id?: string | null;
  waiver_url?: string | null;
  waiver_filename?: string | null;
  waiver_body?: string | null;
  rental_mode?: string | null;
  rental_buffer_hours?: number | null;
  rental_quantity?: number | null;
  fareharbor_shortname?: string | null;
  fareharbor_flow?: string | null;
  rental_deposit_type?: string | null;
  rental_deposit_value?: number | null;
  cta_type?: string | null;
  sold_at?: string | null;
  created_at: string;
};

type Inquiry = {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  message: string | null;
  inquiry_type: string;
  listing_title: string;
  is_read: boolean;
  created_at: string;
};

type Booking = {
  id: string;
  status: string;
  scheduled_at: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  title: string | null;
  source?: string | null;
  buyer: { full_name: string | null; email: string } | null;
  listing: { title: string } | null;
};

type RentalBooking = {
  id: string;
  status: string;
  duration_label: string;
  duration_hours: number;
  total_price: number;
  start_date: string;
  start_time: string;
  end_date: string | null;
  notes: string | null;
  waiver_signer_name: string | null;
  signed_waiver_pdf_url: string | null;
  payment_status: string | null;
  deposit_amount: number | null;
  created_at: string;
  customer: { full_name: string | null; email: string } | null;
  listing: { title: string } | null;
};

type ThriftOffer = {
  id: string;
  listing_id: string;
  listing_title: string | null;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  message: string | null;
  status: string;
  counter_amount: number | null;
  created_at: string;
};

type Customer = {
  id: string;
  full_name: string | null;
  email: string;
  booking_count: number;
  total_spent: number;
  last_booking_at: string | null;
};

const NAV: { id: Tab; label: string; icon: string; premiumOnly?: boolean; adminOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "store", label: "Store Settings", icon: "🏪" },
  { id: "pagecontent", label: "Page Content", icon: "🖼️" },
  { id: "listings", label: "Listings", icon: "📦" },
  { id: "referrals", label: "Referrals", icon: "🤝" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "messages", label: "Messages", icon: "💬", premiumOnly: true },
  { id: "bookings", label: "Appointments", icon: "📅", premiumOnly: true },
  { id: "rentals", label: "Rentals", icon: "🏕️" },
  { id: "offers", label: "Offers", icon: "🤝" },
  { id: "analytics", label: "Analytics", icon: "📊", premiumOnly: true },
  { id: "crm", label: "Estimates & Customers", icon: "👥", premiumOnly: true },
  { id: "myplaces", label: "My Places", icon: "🌿" },
  { id: "businesses", label: "All Businesses", icon: "🏙️", adminOnly: true },
  { id: "alllistings", label: "All Listings", icon: "🗂️", adminOnly: true },
  { id: "allplaces", label: "All Places", icon: "🌿", adminOnly: true },
];

export default function VendorDashboardClient({ vendor, profile, isPremium, features, activeListingCap, isAdmin, connectEnabled, connectAccountId, initialTab }: Props) {
  // Local Pro+ exclusive tier (admins always count as top tier).
  const isPlus = isAdmin || isPlusTier(vendor.tier);
  // Features gated to Pro+ only; everything else unlocks for any paid tier.
  const PLUS_ONLY = new Set<FeatureKey>(["estimates"]);
  const can = (f: FeatureKey) => hasFeature(features, f) || (PLUS_ONLY.has(f) ? isPlus : isPremium);
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>((initialTab as Tab) || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabStack, setTabStack] = useState<Tab[]>([]);
  const goToTab = (t: Tab) => {
    setTabStack((s) => (t === tab ? s : [...s, tab]));
    setTab(t);
    setSidebarOpen(false);
  };
  const goBack = () => setTabStack((s) => {
    if (!s.length) return s;
    setTab(s[s.length - 1]);
    return s.slice(0, -1);
  });

  function awardScore(action: "login" | "message" | "listing" | "sale") {
    fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, vendor_id: vendor.id }) }).catch(() => {});
  }
  const [crmView, setCrmView] = useState<"board" | "estimates" | "tools" | "metrics">("board");
  const [estimateContact, setEstimateContact] = useState<any>(null);
  const [showUpgradedToast, setShowUpgradedToast] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("upgraded") === "1"
  );
  const [connectToast, setConnectToast] = useState<"success" | "refresh" | null>(
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("connect") as "success" | "refresh" | null)
      : null
  );
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [openingConnectDashboard, setOpeningConnectDashboard] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rentalBookings, setRentalBookings] = useState<RentalBooking[]>([]);
  const [offers, setOffers] = useState<ThriftOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingRentals, setLoadingRentals] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [stats, setStats] = useState({ totalViews: 0, totalClicks: 0, totalListings: 0, activeListings: 0, pendingBookings: 0, thisWeekViews: 0, timesTagged: 0 });
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localProfile, setLocalProfile] = useState({ full_name: profile?.full_name ?? null, avatar_url: profile?.avatar_url ?? null, phone: profile?.phone ?? null });
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [showNewListing, setShowNewListing] = useState(false);

  const loadListings = useCallback(async () => {
    setLoadingListings(true);
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    setListings(data ?? []);

    const total = data?.reduce((s, l) => s + (l.view_count ?? 0), 0) ?? 0;
    const clicks = data?.reduce((s, l) => s + (l.click_count ?? 0), 0) ?? 0;
    setStats((prev) => ({
      ...prev,
      totalViews: total,
      totalClicks: clicks,
      totalListings: data?.length ?? 0,
      activeListings: data?.filter((l) => l.is_active).length ?? 0,
    }));
    setLoadingListings(false);
  }, [supabase, vendor.id]);

  const loadMentions = useCallback(async () => {
    // How many times this business has been @-tagged in the community.
    const { count } = await supabase
      .from("community_mentions")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "vendor")
      .eq("target_id", vendor.id);
    setStats((prev) => ({ ...prev, timesTagged: count ?? 0 }));
  }, [supabase, vendor.id]);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    const { data } = await supabase
      .from("bookings")
      .select("*, buyer:profiles(full_name, email), listing:listings(title)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setBookings((data as Booking[]) ?? []);
    setStats((prev) => ({
      ...prev,
      pendingBookings: data?.filter((b) => b.status === "pending").length ?? 0,
    }));
    setLoadingBookings(false);
  }, [supabase, vendor.id]);

  const loadRentalBookings = useCallback(async () => {
    setLoadingRentals(true);
    const { data } = await supabase
      .from("rental_bookings")
      .select("*, customer:profiles(full_name, email), listing:listings(title)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRentalBookings((data as RentalBooking[]) ?? []);
    setLoadingRentals(false);
  }, [supabase, vendor.id]);

  const updateRentalBookingStatus = useCallback(async (id: string, status: string) => {
    await supabase.from("rental_bookings").update({ status }).eq("id", id);
    setRentalBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, [supabase]);

  const loadOffers = useCallback(async () => {
    setLoadingOffers(true);
    const { data } = await supabase
      .from("thrift_offers")
      .select("id, listing_id, listing_title, buyer_name, buyer_email, amount, message, status, counter_amount, created_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setOffers((data as ThriftOffer[]) ?? []);
    setLoadingOffers(false);
  }, [supabase, vendor.id]);

  const updateOffer = useCallback(async (id: string, status: string, counterAmount?: number) => {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "countered" && counterAmount != null) patch.counter_amount = counterAmount;
    await supabase.from("thrift_offers").update(patch).eq("id", id);
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status, counter_amount: status === "countered" ? (counterAmount ?? o.counter_amount) : o.counter_amount } : o)));
  }, [supabase]);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("buyer_id, amount, created_at, buyer:profiles(id, full_name, email)")
      .eq("vendor_id", vendor.id)
      .eq("status", "completed");

    if (!data) return;

    const map = new Map<string, Customer>();
    for (const b of data) {
      const buyer = Array.isArray(b.buyer) ? b.buyer[0] : b.buyer;
      if (!buyer) continue;
      const existing = map.get(buyer.id) ?? {
        id: buyer.id,
        full_name: buyer.full_name,
        email: buyer.email,
        booking_count: 0,
        total_spent: 0,
        last_booking_at: null,
      };
      existing.booking_count++;
      existing.total_spent += b.amount ?? 0;
      if (!existing.last_booking_at || b.created_at > existing.last_booking_at) {
        existing.last_booking_at = b.created_at;
      }
      map.set(buyer.id, existing);
    }
    setCustomers(Array.from(map.values()).sort((a, b) => b.total_spent - a.total_spent));
  }, [supabase, vendor.id]);

  const loadInquiries = useCallback(async () => {
    const { data } = await supabase
      .from("purchase_inquiries")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    if (data) {
      setInquiries(data);
      setUnreadCount(data.filter((i) => !i.is_read).length);
    }
  }, [supabase, vendor.id]);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*, buyer:profiles(id, full_name)")
      .eq("vendor_id", vendor.id)
      .order("last_message_at", { ascending: false });
    if (data) {
      setConversations(data);
      setUnreadMsgCount(data.reduce((n: number, c: any) => n + (c.vendor_unread ?? 0), 0));
    }
  }, [supabase, vendor.id]);

  async function openConversation(convId: string) {
    setActiveConvId(convId);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setConvMessages(data ?? []);
    // Mark vendor unread = 0
    await supabase.from("conversations").update({ vendor_unread: 0 }).eq("id", convId);
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, vendor_unread: 0 } : c));
    setUnreadMsgCount((n) => Math.max(0, n - (conversations.find((c) => c.id === convId)?.vendor_unread ?? 0)));
  }

  async function sendVendorMessage() {
    if (!msgBody.trim() || !activeConvId) return;
    const text = msgBody.trim();
    setMsgBody("");
    const conv = conversations.find((c) => c.id === activeConvId);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: vendor.user_id, body: text, created_at: new Date().toISOString() };
    setConvMessages((prev) => [...prev, optimistic]);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: activeConvId, body: text }),
    });
    const { message: inserted } = await res.json();
    if (inserted) setConvMessages((prev) => prev.map((m) => m.id === optimistic.id ? inserted : m));
    await supabase.from("conversations").update({
      buyer_unread: (conv?.buyer_unread ?? 0) + 1,
    }).eq("id", activeConvId);
    awardScore("message");
  }

  async function markInquiryRead(id: string) {
    await supabase.from("purchase_inquiries").update({ is_read: true }).eq("id", id);
    setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, is_read: true } : i));
    setUnreadCount((n) => Math.max(0, n - 1));
  }

  useEffect(() => {
    loadListings();
    loadBookings();
    loadRentalBookings();
    loadOffers();
    loadMentions();
    loadInquiries();
    loadConversations();
    if (isPremium || isAdmin) loadCustomers();
    awardScore("login");
  }, [loadListings, loadBookings, loadRentalBookings, loadOffers, loadCustomers, loadInquiries, loadConversations, isPremium]);

  async function toggleListingActive(id: string, current: boolean) {
    await supabase.from("listings").update({ is_active: !current }).eq("id", id);
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, is_active: !current } : l));
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing?")) return;
    await supabase.from("listings").delete().eq("id", id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  async function manageSubscription() {
    setManagingSubscription(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setManagingSubscription(false);
  }

  async function connectStripe() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return; // keep the button in its loading state during redirect
      }
      alert(data.error ?? "Couldn't start Stripe setup. Please try again.");
    } catch {
      alert("Couldn't reach the server. Please check your connection and try again.");
    }
    setConnectingStripe(false);
  }

  async function openConnectDashboard() {
    setOpeningConnectDashboard(true);
    const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
    setOpeningConnectDashboard(false);
  }

  async function updateBookingStatus(id: string, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
  }

  async function createAppointment(input: {
    title: string; customer_name: string; customer_phone: string;
    scheduled_at: string; notes: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from("bookings").insert({
      vendor_id: vendor.id,
      buyer_id: null,
      status: "confirmed",
      source: "manual",
      title: input.title || null,
      customer_name: input.customer_name || null,
      customer_phone: input.customer_phone || null,
      scheduled_at: input.scheduled_at || null,
      notes: input.notes || null,
    });
    if (error) return { ok: false, error: error.message };
    await loadBookings();
    return { ok: true };
  }

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      {/* Sidebar — off-canvas drawer on mobile, fixed sidebar on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col overflow-y-auto transform transition-transform duration-200 lg:translate-x-0 lg:static lg:sticky lg:top-0 lg:min-h-screen lg:z-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-gray-100">
          <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
        </div>

        {/* Vendor info */}
        <div className="p-4 border-b border-gray-100">
          {/* Business row */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-green-700 overflow-hidden shrink-0 ${vendor.logo_url ? "bg-white border border-gray-100" : "bg-green-100"}`}>
              {vendor.logo_url
                ? <img src={vendor.logo_url} alt="" className="w-full h-full object-contain" />
                : vendor.business_name[0]}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{vendor.business_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPremium ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                {isAdmin ? "👑 Admin" : vendor.tier === "premium_plus" ? "💎 Local Pro+" : isPremium ? "⭐ Local Pro" : "Free"}
              </span>
            </div>
          </div>

          {/* Admin link */}
          {isAdmin && (
            <a href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors mb-1">
              👑 Admin Panel
            </a>
          )}

          {/* Local Bucks balance — circle between Admin Panel and Manage My Store */}
          <div className="mt-3 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-amber-50 border-2 border-amber-200 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-base leading-none">🪙</span>
              <span className="text-sm font-bold text-amber-700 leading-tight mt-0.5">{formatLocalBucks(profile?.local_bucks ?? 0)}</span>
              <span className="text-[10px] text-amber-600 leading-tight px-1">Local Bucks</span>
            </div>
          </div>

          <button
            onClick={() => goToTab("store")}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            🏪 Manage My Store
          </button>
          {vendor.city && (
            <>
              <Link
                href={`/community/${vendor.city.toLowerCase().replace(/\s+/g, "-")}-${(vendor.state || "mn").toLowerCase()}`}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-white border border-green-300 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                🏘️ Local Pages
              </Link>
              <Link
                href={`/jobs/${vendor.city.toLowerCase().replace(/\s+/g, "-")}-${(vendor.state || "mn").toLowerCase()}`}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-white border border-green-300 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                💼 Post a Job
              </Link>
            </>
          )}

          {/* Local Profile — switch from this business view to your own Top 8 */}
          <Link
            href="/profile"
            className="mt-2 w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors"
          >
            ⭐ Edit Local Profile
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.id}
              onClick={() => goToTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                tab === item.id
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "messages" && unreadMsgCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadMsgCount}</span>
              )}
              {item.id === "notifications" && unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
              )}
              {item.premiumOnly && !can(item.id as FeatureKey) && item.id !== "messages" && (
                <span className="ml-auto text-xs text-gray-300">🔒</span>
              )}
              {item.id === "messages" && !can("messages") && unreadMsgCount === 0 && (
                <span className="ml-auto text-xs text-gray-300">🔒</span>
              )}
              {item.id === "bookings" && stats.pendingBookings > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.pendingBookings}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          {/* View boxes — your business storefront and your personal Local Profile */}
          <div className="grid grid-cols-2 gap-2 mb-1">
            <Link
              href={`/vendors/${vendor.slug}`}
              className="flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors text-center"
            >
              <span className="text-lg">🔗</span>
              <span className="text-xs font-semibold leading-tight">View store page</span>
            </Link>
            <Link
              href={`/u/${vendor.user_id}`}
              className="flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors text-center"
            >
              <span className="text-lg">⭐</span>
              <span className="text-xs font-semibold leading-tight">View Local Profile</span>
            </Link>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span>⚙️</span> Account Settings
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <span>🚪</span> Sign out
          </button>
          {isPremium ? (
            <button
              onClick={manageSubscription}
              disabled={managingSubscription}
              className="mt-2 w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {managingSubscription ? "Loading..." : "⚙️ Manage subscription"}
            </button>
          ) : (
            <Link
              href="/dashboard/vendor/upgrade"
              className="mt-2 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              ⭐ Upgrade to Local Pro
            </Link>
          )}

          {/* Stripe Connect — a Local Pro+ feature; others get an upgrade prompt */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            {!isPlus ? (
              <Link
                href="/dashboard/vendor/upgrade"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                💳 Get paid with Stripe
              </Link>
            ) : connectEnabled ? (
              <button
                onClick={openConnectDashboard}
                disabled={openingConnectDashboard}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                {openingConnectDashboard ? "Opening..." : "💳 Stripe payments dashboard"}
              </button>
            ) : (
              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {connectingStripe ? "Redirecting..." : "💳 Connect Stripe to get paid"}
              </button>
            )}
            {!isPlus && (
              <p className="text-xs text-center text-gray-400 mt-1.5">Local Pro+ feature</p>
            )}
            {isPlus && !connectEnabled && connectAccountId && (
              <p className="text-xs text-center text-yellow-600 mt-1.5">Setup incomplete — click to finish</p>
            )}
            {isPlus && connectEnabled && (
              <p className="text-xs text-center text-green-600 mt-1.5">✓ Payments enabled</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-2 -ml-2 text-gray-700 hover:text-green-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-green-600">Everything Local</span>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* Internal back button — appears once you've navigated between tabs */}
          {tabStack.length > 0 && (
            <button onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}

          {/* Upgrade success toast */}
          {showUpgradedToast && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="font-semibold text-green-800">Welcome to Local Pro!</p>
                  <p className="text-sm text-green-600">Analytics, estimates, messages, and CRM are now unlocked.</p>
                </div>
              </div>
              <button onClick={() => setShowUpgradedToast(false)} className="text-green-400 hover:text-green-600 text-lg">✕</button>
            </div>
          )}

          {/* Stripe Connect toasts */}
          {connectToast === "success" && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <p className="font-semibold text-blue-800">Stripe account connected!</p>
                  <p className="text-sm text-blue-600">You can now accept payments directly from customers.</p>
                </div>
              </div>
              <button onClick={() => setConnectToast(null)} className="text-blue-400 hover:text-blue-600 text-lg">✕</button>
            </div>
          )}
          {connectToast === "refresh" && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-yellow-800">Stripe setup incomplete</p>
                  <p className="text-sm text-yellow-600">Click "Connect Stripe" below to finish setting up your account.</p>
                </div>
              </div>
              <button onClick={() => setConnectToast(null)} className="text-yellow-400 hover:text-yellow-600 text-lg">✕</button>
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"} 👋</h1>
                  <p className="text-gray-500 text-sm mt-0.5">{vendor.business_name} · {vendor.city}, {vendor.state}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ReferralCopyButton referralCode={profile?.referral_code ?? ""} />
                  <button
                    onClick={() => { goToTab("listings"); setShowNewListing(true); }}
                    className="bg-green-600 text-white px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap"
                  >
                    + Add Listing
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Store Visits", value: (vendor.profile_views ?? 0).toLocaleString(), icon: "🏬", color: "blue" },
                  { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: "👁️", color: "blue" },
                  { label: "Total Clicks", value: stats.totalClicks.toLocaleString(), icon: "🖱️", color: "purple" },
                  { label: "Active Listings", value: `${stats.activeListings}/${stats.totalListings}`, icon: "📦", color: "green" },
                  { label: "Pending Bookings", value: stats.pendingBookings.toString(), icon: "📅", color: "amber" },
                  { label: "Times Tagged", value: stats.timesTagged.toLocaleString(), icon: "🏷️", color: "green" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{s.icon}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Stripe Connect banner — shown to everyone; free vendors get an upgrade prompt */}
              {!connectEnabled && (
                <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div>
                      <p className="font-semibold text-indigo-900">Accept payments from customers</p>
                      <p className="text-sm text-indigo-600">
                        {isPlus
                          ? "Connect your Stripe account to get paid directly — no middleman."
                          : "Upgrade to Local Pro+ to get paid directly through Stripe — no middleman."}
                      </p>
                    </div>
                  </div>
                  {isPlus ? (
                    <button
                      onClick={connectStripe}
                      disabled={connectingStripe}
                      className="shrink-0 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {connectingStripe ? "Redirecting..." : "Connect Stripe →"}
                    </button>
                  ) : (
                    <Link
                      href="/dashboard/vendor/upgrade"
                      className="shrink-0 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Upgrade to get paid →
                    </Link>
                  )}
                </div>
              )}
              {isPlus && connectEnabled && (
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-semibold text-indigo-900">Payments enabled</p>
                      <p className="text-sm text-indigo-500">Customers can pay you directly through Everything Local.</p>
                    </div>
                  </div>
                  <button
                    onClick={openConnectDashboard}
                    disabled={openingConnectDashboard}
                    className="shrink-0 border border-indigo-200 text-indigo-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {openingConnectDashboard ? "Opening..." : "View payouts →"}
                  </button>
                </div>
              )}

              {/* Rating & LB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-1">Rating</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {vendor.rating > 0 ? vendor.rating.toFixed(1) : "—"}
                    </span>
                    <span className="text-amber-400 text-xl">★</span>
                    <span className="text-gray-400 text-sm">({vendor.review_count} reviews)</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-1">Local Bucks</p>
                  <div className="flex items-baseline gap-2">
                    {/* Same wallet balance as your personal page — one balance per account */}
                    <span className="text-3xl font-bold text-amber-600">{(profile?.local_bucks ?? 0).toLocaleString()}</span>
                    <span className="text-amber-400 text-sm">🪙</span>
                  </div>
                </div>
              </div>

              {/* Recent listings */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Listings</h2>
                  <button onClick={() => goToTab("listings")} className="text-sm text-green-600 hover:underline">
                    View all →
                  </button>
                </div>
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm mb-4">No listings yet.</p>
                    <button
                      onClick={() => { goToTab("listings"); setShowNewListing(true); }}
                      className="text-sm text-green-600 font-medium hover:underline"
                    >
                      Add your first listing →
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {listings.slice(0, 5).map((l) => (
                      <div key={l.id} className="flex items-center gap-4 px-6 py-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                          <p className="text-xs text-gray-400">{l.category} · {l.price ? formatPrice(l.price) : l.price_label ?? "—"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-gray-700">{l.view_count} views</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                            {l.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Premium upsell for free users */}
              {!isPremium && (
                <div className="mt-6 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-lg mb-1">Unlock your full dashboard</p>
                      <p className="text-green-100 text-sm mb-4">
                        Get analytics, CRM tools, booking management, and smart buttons for <LocalProPriceInline inverted />.
                      </p>
                      <Link
                        href="/dashboard/vendor/upgrade"
                        className="inline-block bg-white text-green-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-50 transition-colors"
                      >
                        Upgrade Now →
                      </Link>
                    </div>
                    <span className="text-5xl opacity-30">⭐</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LISTINGS ── */}
          {tab === "listings" && (
            <ListingsTab
              listings={listings}
              loading={loadingListings}
              vendorId={vendor.id}
              cap={activeListingCap}
              menuPdfUrl={vendor.menu_pdf_url ?? null}
              onGoToStore={() => goToTab("store")}
              showNew={showNewListing}
              onShowNew={setShowNewListing}
              onToggle={toggleListingActive}
              onDelete={deleteListing}
              onRefresh={loadListings}
              editingListing={editingListing}
              onEdit={setEditingListing}
            />
          )}

          {/* ── ANALYTICS ── */}
          {tab === "analytics" && (
            can("analytics") ? (
              <AnalyticsTab listings={listings} stats={stats} vendorId={vendor.id} />
            ) : <PremiumGate feature="Analytics Dashboard" />
          )}

          {/* ── BOOKINGS ── */}
          {tab === "bookings" && (
            can("bookings") ? (
              <BookingsTab
                bookings={bookings}
                loading={loadingBookings}
                onUpdateStatus={updateBookingStatus}
                onCreate={createAppointment}
                vendorName={vendor.business_name}
              />
            ) : <PremiumGate feature="Booking Management" />
          )}

          {/* ── RENTALS ── */}
          {tab === "rentals" && (
            <RentalsTab
              bookings={rentalBookings}
              loading={loadingRentals}
              onUpdateStatus={updateRentalBookingStatus}
            />
          )}

          {/* ── THRIFT OFFERS ── */}
          {tab === "offers" && (
            <OffersTab
              offers={offers}
              loading={loadingOffers}
              onUpdate={updateOffer}
            />
          )}

          {/* ── CRM ── */}
          {tab === "crm" && (
            can("crm") ? (
              <div className="flex flex-col h-full">
                <div className="flex gap-3 mb-5">
                  <button
                    onClick={() => { setCrmView("board"); setEstimateContact(null); }}
                    className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${crmView === "board" ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    👥 Pipeline
                  </button>
                  {can("estimates") && (
                    <>
                      <button
                        onClick={() => setCrmView("estimates")}
                        className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${crmView === "estimates" ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        📋 Estimates
                      </button>
                      <button
                        onClick={() => { setCrmView("tools"); setEstimateContact(null); }}
                        className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${crmView === "tools" ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        🧰 Estimator Tools
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setCrmView("metrics"); setEstimateContact(null); }}
                    className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${crmView === "metrics" ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    📊 Job Metrics
                  </button>
                </div>
                {crmView === "board" ? (
                  <CrmBoard
                    vendorId={vendor.id}
                    onCreateEstimate={(contact) => { setEstimateContact(contact); setCrmView("estimates"); }}
                  />
                ) : crmView === "metrics" ? (
                  <JobMetrics vendorId={vendor.id} />
                ) : !can("estimates") ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="font-bold text-gray-900">Estimate Creator is a Local Pro+ feature</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Build and send professional, itemized estimates to your customers.</p>
                    <Link href="/dashboard/vendor/upgrade" className="inline-block bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors">Upgrade to Local Pro+ →</Link>
                  </div>
                ) : crmView === "tools" ? (
                  <EstimatorTools vendorId={vendor.id} userId={vendor.user_id} />
                ) : (
                  <ProposalBuilder
                    vendorId={vendor.id}
                    userId={vendor.user_id}
                    defaultContact={estimateContact}
                    onBack={() => { setCrmView("board"); setEstimateContact(null); }}
                  />
                )}
              </div>
            ) : <PremiumGate feature="Customer CRM" />
          )}

          {tab === "referrals" && (
            <ReferralsTab
              userId={vendor.user_id}
              referralCode={profile?.referral_code ?? ""}
              businessName={vendor.business_name}
            />
          )}

          {tab === "store" && (
            <div className="space-y-6">
              <StoreSettingsTab vendor={vendor} supabase={supabase} />
              <CustomDomainPanel
                isPremium={isPlus}
                initialDomain={vendor.custom_domain ?? null}
                initialVerified={vendor.domain_verified ?? false}
              />
            </div>
          )}

          {tab === "pagecontent" && (
            <div className="p-6 max-w-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Page Content</h2>
              <p className="text-sm text-gray-500 mb-6">Add photo and text sections to your public business page.</p>
              <PageBlocksEditor vendorId={vendor.id} initialBlocks={Array.isArray(vendor.page_blocks) ? vendor.page_blocks : []} supabase={supabase} />
            </div>
          )}

          {/* ── ALL BUSINESSES (admin only) ── */}
          {tab === "myplaces" && (
            <MyPlacesTab userId={vendor.user_id} />
          )}

          {tab === "businesses" && isAdmin && (
            <AdminBusinessesTab />
          )}

          {/* ── ALL LISTINGS (admin only) ── */}
          {tab === "alllistings" && isAdmin && (
            <AdminListingsTab />
          )}

          {/* ── ALL PLACES (admin only) ── */}
          {tab === "allplaces" && isAdmin && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-black text-gray-900">All Places</h2>
                <p className="text-sm text-gray-400">Community places — parks, campgrounds, attractions, and food trucks.</p>
              </div>
              <PlacesManager adminId={vendor.user_id} />
            </div>
          )}

          {tab === "messages" && !can("messages") && (
            <PremiumGate feature="Messages" />
          )}
          {tab === "messages" && can("messages") && (
            <div className="flex gap-4 h-[70vh] lg:h-[600px]">
              {/* Conversation list — full width on mobile, hidden once a chat is open */}
              <div className={`w-full lg:w-64 lg:shrink-0 border border-gray-100 rounded-2xl overflow-y-auto bg-white ${activeConvId ? "hidden lg:block" : "block"}`}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">💬 Messages</h2>
                </div>
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No messages yet.</div>
                ) : (
                  conversations.map((c) => {
                    const buyer = Array.isArray(c.buyer) ? c.buyer[0] : c.buyer;
                    return (
                      <button
                        key={c.id}
                        onClick={() => openConversation(c.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-green-50 transition-colors ${activeConvId === c.id ? "bg-green-50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">{buyer?.full_name ?? "Buyer"}</p>
                          {c.vendor_unread > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{c.vendor_unread}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.listing_title}</p>
                        {c.last_message_preview && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message_preview}</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Chat thread — full screen on mobile when a chat is open */}
              <div className={`flex-1 border border-gray-100 rounded-2xl flex-col bg-white overflow-hidden ${activeConvId ? "flex" : "hidden lg:flex"}`}>
                {!activeConvId ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    Select a conversation to view messages
                  </div>
                ) : (
                  <>
                    {/* Mobile back to list */}
                    <div className="lg:hidden px-4 py-2.5 border-b border-gray-100">
                      <button onClick={() => setActiveConvId(null)} className="text-sm font-medium text-gray-500 hover:text-green-700">← All messages</button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                      {convMessages.map((m) => {
                        const isMe = m.sender_id === vendor.user_id;
                        return (
                          <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                              isMe ? "bg-green-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
                            }`}>
                              <p>{m.body}</p>
                              <p className={`text-xs mt-1 ${isMe ? "text-green-200" : "text-gray-400"}`}>
                                {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                      <input
                        type="text"
                        value={msgBody}
                        onChange={(e) => setMsgBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") sendVendorMessage(); }}
                        placeholder="Type a reply..."
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button onClick={sendVendorMessage} disabled={!msgBody.trim()}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-lg">🔔 Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-400">{unreadCount} unread</span>
                )}
              </div>
              {inquiries.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-5xl mb-3">🔔</div>
                  <p className="font-medium text-gray-500">No inquiries yet</p>
                  <p className="text-sm mt-1">Buy Now and Book Now requests will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      onClick={() => !inq.is_read && markInquiryRead(inq.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                        inq.is_read ? "bg-white border-gray-100" : "bg-green-50 border-green-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              inq.inquiry_type === "buy"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {inq.inquiry_type === "buy" ? "🛒 Buy Now" : "📅 Book Now"}
                            </span>
                            {!inq.is_read && (
                              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{inq.listing_title}</p>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-sm text-gray-700 font-medium">{inq.buyer_name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              ✉️ <a href={`mailto:${inq.buyer_email}`} className="hover:underline text-green-700">{inq.buyer_email}</a>
                            </p>
                            {inq.buyer_phone && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                📞 <a href={`tel:${inq.buyer_phone}`} className="hover:underline text-green-700">{inq.buyer_phone}</a>
                              </p>
                            )}
                            {inq.message && (
                              <p className="text-xs text-gray-500 mt-1 italic">"{inq.message}"</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400">
                            {new Date(inq.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(inq.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>

    {showSettings && profile && (
      <AccountSettingsModal
        profile={{ id: vendor.user_id, full_name: localProfile.full_name, email: profile.email ?? "", avatar_url: localProfile.avatar_url, phone: localProfile.phone }}
        onClose={() => setShowSettings(false)}
        onSaved={(updated) => setLocalProfile(updated)}
      />
    )}
    </>
  );
}

// ── LISTINGS TAB ──────────────────────────────────────────────
function ListingsTab({
  listings, loading, vendorId, cap, menuPdfUrl, onGoToStore, showNew, onShowNew,
  onToggle, onDelete, onRefresh, editingListing, onEdit,
}: {
  listings: Listing[]; loading: boolean; vendorId: string; cap: number | null;
  menuPdfUrl: string | null; onGoToStore: () => void;
  showNew: boolean; onShowNew: (v: boolean) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void; onRefresh: () => void;
  editingListing: Listing | null; onEdit: (l: Listing | null) => void;
}) {
  const supabase = createClient();
  const activeCount = listings.filter((l) => l.is_active).length;
  const [cats, setCats] = useState<ListingCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const loadCats = useCallback(async () => {
    const { data } = await supabase.from("listing_categories").select("id, name, position").eq("vendor_id", vendorId).order("position");
    setCats(data ?? []);
  }, [supabase, vendorId]);
  useEffect(() => { loadCats(); }, [loadCats]);
  const catName = (id?: string | null) => cats.find((c) => c.id === id)?.name ?? null;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // Assign one or many listings to a product category (null = uncategorized).
  async function assignCategory(ids: string[], catId: string | null) {
    if (!ids.length) return;
    await supabase.from("listings").update({ listing_category_id: catId }).in("id", ids);
    onRefresh();
  }
  // Thrift one-of-a-kind items: toggle SOLD (also frees/holds the item).
  async function markSold(id: string, sold: boolean) {
    await supabase.from("listings").update({ sold_at: sold ? new Date().toISOString() : null }).eq("id", id);
    onRefresh();
  }
  const [boostListingId, setBoostListingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", type: "product", price: "", price_label: "", description: "",
    category: "Products", quantity: "", condition: "new", tags: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Products"]);
  const [ctaType, setCtaType] = useState<ListingCtaType>(defaultCtaForListingType("product"));
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rentalDurations, setRentalDurations] = useState<{ label: string; hours: number; price: number }[]>([]);
  const [rentalWaiverUrl, setRentalWaiverUrl] = useState<string | null>(null);
  const [rentalWaiverFilename, setRentalWaiverFilename] = useState<string | null>(null);
  const [rentalSettings, setRentalSettings] = useState<import("@/components/rental/RentalSetup").RentalSettings>({
    rental_mode: "hourly", rental_buffer_hours: "0", rental_quantity: "1",
    waiver_body: "", fareharbor_shortname: "", fareharbor_flow: "",
    rental_deposit_type: "none", rental_deposit_value: "50",
  });
  const [thriftAddress, setThriftAddress] = useState("");
  const [housing, setHousing] = useState({
    address: "", bedrooms: "", bathrooms: "", sqft: "", lot_size: "",
    year_built: "", garage: false, pets_allowed: false, furnished: false,
    available_date: "", lease_term: "12 months",
  });
  const [thriftHours, setThriftHours] = useState([
    { day: "Monday", open: "", close: "", closed: false },
    { day: "Tuesday", open: "", close: "", closed: false },
    { day: "Wednesday", open: "", close: "", closed: false },
    { day: "Thursday", open: "", close: "", closed: false },
    { day: "Friday", open: "", close: "", closed: false },
    { day: "Saturday", open: "", close: "", closed: false },
    { day: "Sunday", open: "", close: "", closed: true },
  ]);

  useEffect(() => {
    if (editingListing) {
      setForm({
        title: editingListing.title,
        type: editingListing.type,
        price: editingListing.price?.toString() ?? "",
        price_label: editingListing.price_label ?? "",
        description: "",
        category: editingListing.category,
        quantity: editingListing.quantity?.toString() ?? "",
        condition: editingListing.condition ?? "new",
        tags: editingListing.tags?.join(", ") ?? "",
      });
      setSelectedCategories(
        editingListing.categories?.length
          ? editingListing.categories
          : [editingListing.category]
      );
      setCtaType(isListingCtaType(editingListing.cta_type) ? editingListing.cta_type : defaultCtaForListingType(editingListing.type));
      setCategoryId(editingListing.listing_category_id ?? "");
      setImages(editingListing.images ?? []);
      if (editingListing.type === "thrift") {
        setThriftAddress(editingListing.price_label ?? "");
        try {
          const parsed = JSON.parse(editingListing.tags?.find((t) => t.startsWith("__hours:"))?.replace("__hours:", "") ?? "null");
          if (parsed) setThriftHours(parsed);
        } catch {}
      }
      if (editingListing.type === "housing_sale" || editingListing.type === "housing_rent") {
        try {
          const h = JSON.parse(editingListing.tags?.find((t) => t.startsWith("__housing:"))?.replace("__housing:", "") ?? "null");
          if (h) setHousing(h);
        } catch {}
      }
      if (editingListing.type === "rental") {
        setRentalSettings({
          rental_mode: editingListing.rental_mode ?? "hourly",
          rental_buffer_hours: String(editingListing.rental_buffer_hours ?? 0),
          rental_quantity: String(editingListing.rental_quantity ?? 1),
          waiver_body: editingListing.waiver_body ?? "",
          fareharbor_shortname: editingListing.fareharbor_shortname ?? "",
          fareharbor_flow: editingListing.fareharbor_flow ?? "",
          rental_deposit_type: editingListing.rental_deposit_type ?? "none",
          rental_deposit_value: String(editingListing.rental_deposit_value ?? 50),
        });
      }
      onShowNew(true);
    }
  }, [editingListing, onShowNew]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > 6) {
      alert("Maximum 6 photos per listing.");
      return;
    }
    setUploadingImage(true);
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} is over 5MB`); continue; }
      const ext = file.name.split(".").pop();
      const path = `${vendorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
    }
    setImages((prev) => [...prev, ...uploaded]);
    setUploadingImage(false);
    e.target.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const swap = index + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }

  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Clone a listing. Copies every field; the copy starts paused so the vendor
  // can tweak it (and it doesn't immediately count against the active cap).
  async function duplicateListing(l: Listing) {
    setDuplicatingId(l.id);
    const { data: full } = await supabase.from("listings").select("*").eq("id", l.id).single();
    if (!full) { setDuplicatingId(null); return; }
    const { id, view_count, click_count, created_at, updated_at, search_vector, ...rest } = full as any;
    const { error } = await supabase.from("listings").insert({
      ...rest,
      title: `${full.title} (Copy)`,
      is_active: false,
      is_featured: false,
    });
    setDuplicatingId(null);
    if (error) { alert("Couldn't duplicate this listing: " + error.message); return; }
    onRefresh();
  }

  async function saveListing() {
    setSaving(true);
    setSaveError(null);

    // Duplicate listing check (new listings only)
    if (!editingListing && form.title.trim()) {
      try {
        const dupeRes = await fetch("/api/listings/check-dupe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendor_id: vendorId, title: form.title.trim() }),
        });
        const { isDuplicate } = await dupeRes.json();
        if (isDuplicate) {
          setSaveError("A listing with this title already exists. Please use a unique title.");
          setSaving(false);
          return;
        }
      } catch { /* non-blocking — proceed if check fails */ }
    }

    // Base payload — always works regardless of migration status
    const isThrift = form.type === "thrift";
    const isHousing = form.type === "housing_sale" || form.type === "housing_rent";
    const regularTags = form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
    const thriftTags = isThrift ? [`__hours:${JSON.stringify(thriftHours)}`] : [];
    const housingTags = isHousing ? [`__housing:${JSON.stringify(housing)}`] : [];
    const finalCategories = isHousing
      ? (selectedCategories.includes("Housing & Rentals") ? selectedCategories : [...selectedCategories, "Housing & Rentals"])
      : selectedCategories;

    const basePayload: Record<string, any> = {
      vendor_id: vendorId,
      title: form.title,
      type: form.type,
      price: (isThrift || isHousing) ? (form.price ? Number(form.price) : null) : (form.price ? Number(form.price) : null),
      price_label: isThrift ? (thriftAddress || null) : (form.price_label || null),
      description: form.description || null,
      category: isHousing ? "Housing & Rentals" : (finalCategories[0] ?? form.category),
      categories: finalCategories,
      quantity: null,
      condition: form.type === "product" ? form.condition : null,
      tags: isThrift ? thriftTags : isHousing ? housingTags : regularTags,
      images,
      is_active: true,
      listing_category_id: categoryId || null,
    };

    // Try with waiver/CTA columns first; fall back without them if columns don't exist yet
    // (cta_type requires supabase/product_cta.sql, waiver_* requires rentals.sql)
    let savedListingId: string | null = null;
    const waiverPayload = {
      ...basePayload,
      cta_type: ctaType,
      ...(form.type === "rental" ? {
        waiver_url: rentalWaiverUrl,
        waiver_filename: rentalWaiverFilename,
        waiver_body: rentalSettings.waiver_body || null,
        rental_mode: rentalSettings.rental_mode,
        rental_buffer_hours: Number(rentalSettings.rental_buffer_hours) || 0,
        rental_quantity: Math.max(1, Number(rentalSettings.rental_quantity) || 1),
        fareharbor_shortname: rentalSettings.fareharbor_shortname || null,
        fareharbor_flow: rentalSettings.fareharbor_flow || null,
        rental_deposit_type: rentalSettings.rental_deposit_type || "none",
        rental_deposit_value: Number(rentalSettings.rental_deposit_value) || 0,
      } : {}),
    };

    if (editingListing) {
      const { error } = await supabase.from("listings").update(waiverPayload).eq("id", editingListing.id);
      if (error) {
        // Retry without waiver fields if columns don't exist
        await supabase.from("listings").update(basePayload).eq("id", editingListing.id);
      }
      savedListingId = editingListing.id;
      onEdit(null);
    } else {
      let { data: newListing, error } = await supabase.from("listings").insert(waiverPayload).select("id").single();
      if (error) {
        // Retry without waiver fields
        const res = await supabase.from("listings").insert(basePayload).select("id").single();
        newListing = res.data;
        if (res.error) {
          setSaveError("Failed to save listing: " + res.error.message);
          setSaving(false);
          return;
        }
      }
      savedListingId = newListing?.id ?? null;
    }

    // Save rental durations (only if rental_durations table exists)
    if (form.type === "rental" && savedListingId && rentalDurations.length > 0) {
      try {
        await supabase.from("rental_durations").delete().eq("listing_id", savedListingId);
        await supabase.from("rental_durations").insert(
          rentalDurations.map((d) => ({ listing_id: savedListingId, ...d }))
        );
      } catch { /* table not yet created — run rentals.sql */ }
    }

    setForm({ title: "", type: "product", price: "", price_label: "", description: "", category: "Products", quantity: "", condition: "new", tags: "" });
    setCategoryId("");
    setSelectedCategories(["Products"]);
    setCtaType(defaultCtaForListingType("product"));
    setImages([]);
    setRentalDurations([]);
    setRentalWaiverUrl(null);
    setRentalWaiverFilename(null);
    setRentalSettings({ rental_mode: "hourly", rental_buffer_hours: "0", rental_quantity: "1", waiver_body: "", fareharbor_shortname: "", fareharbor_flow: "", rental_deposit_type: "none", rental_deposit_value: "50" });
    setThriftAddress("");
    setThriftHours([
      { day: "Monday", open: "", close: "", closed: false },
      { day: "Tuesday", open: "", close: "", closed: false },
      { day: "Wednesday", open: "", close: "", closed: false },
      { day: "Thursday", open: "", close: "", closed: false },
      { day: "Friday", open: "", close: "", closed: false },
      { day: "Saturday", open: "", close: "", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ]);
    setHousing({ address: "", bedrooms: "", bathrooms: "", sqft: "", lot_size: "", year_built: "", garage: false, pets_allowed: false, furnished: false, available_date: "", lease_term: "12 months" });
    onShowNew(false);
    onRefresh();
    setSaving(false);
    if (!editingListing) {
      fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listing", vendor_id: vendorId }) }).catch(() => {});
    }
  }

  const LISTING_TYPES = [
    { value: "product", label: "Product" },
    { value: "service", label: "Service" },
    { value: "restaurant", label: "Restaurant / Food" },
    { value: "event", label: "Event" },
    { value: "rental", label: "Rental" },
    { value: "thrift", label: "Thrift Sale" },
    { value: "housing_sale", label: "Home For Sale" },
    { value: "housing_rent", label: "Rental Property" },
  ];
  const CATEGORIES = ["Products", "Thrift Sales", "Services & Trades", "Restaurants & Food", "Events & Rentals", "Health & Beauty", "Home & Garden", "Clothing & Accessories", "Arts & Crafts", "Sports & Outdoors", "Auto & Transportation", "Pet Services", "Childcare & Education", "Housing & Rentals"];

  return (
    <div>
      {boostListingId && (
        <BoostModal
          entityType="listing"
          entityId={boostListingId}
          homepageLabel="Featured Gems"
          returnPath="/dashboard/vendor?tab=listings"
          onClose={() => setBoostListingId(null)}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
          {cap != null && (
            <p className={`text-xs mt-0.5 ${activeCount >= cap ? "text-amber-600 font-medium" : "text-gray-400"}`}>
              {activeCount} of {cap} active listings used{activeCount >= cap ? " — upgrade for more" : ""}
            </p>
          )}
        </div>
        {cap != null && activeCount >= cap ? (
          <a
            href="/pricing"
            className="bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            Upgrade to add more →
          </a>
        ) : (
          <button
            onClick={() => { onEdit(null); onShowNew(true); }}
            className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            + New Listing
          </button>
        )}
      </div>

      <ProductCategoriesManager vendorId={vendorId} categories={cats} onChange={loadCats} />

      {/* New / Edit form */}
      {showNew && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">{editingListing ? "Edit Listing" : "New Listing"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Fresh Farm Eggs (dozen)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => { setForm((f) => ({ ...f, type: e.target.value })); setCtaType(defaultCtaForListingType(e.target.value)); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LISTING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {cats.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Product category <span className="font-normal text-gray-400">(groups it on your page)</span></label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Uncategorized</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Button <span className="font-normal text-gray-400">(shown on your listing)</span></label>
              <select
                value={ctaType}
                onChange={(e) => setCtaType(e.target.value as ListingCtaType)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LISTING_CTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {ctaType === "menu" && (
                menuPdfUrl ? (
                  <p className="text-xs text-green-600 mt-1">✓ Links to your saved menu PDF automatically.</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">
                    No menu saved yet —{" "}
                    <button type="button" onClick={onGoToStore} className="underline font-semibold hover:text-amber-700">
                      add one in Store Settings
                    </button>{" "}
                    so this button works.
                  </p>
                )
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Categories <span className="text-gray-400 font-normal">(select all that apply)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const checked = selectedCategories.includes(c);
                  return (
                    <label key={c} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${
                      checked ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedCategories((prev) =>
                            checked ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                        }}
                        className="accent-green-600"
                      />
                      {c}
                    </label>
                  );
                })}
              </div>
              {selectedCategories.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Select at least one category.</p>
              )}
            </div>
            {form.type !== "thrift" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price label <span className="font-normal text-gray-400">(if no fixed price)</span></label>
                  <input
                    type="text"
                    value={form.price_label}
                    onChange={(e) => setForm((f) => ({ ...f, price_label: e.target.value }))}
                    placeholder="e.g. Starting at $50 / Free estimate"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </>
            )}
            {form.type === "thrift" && (
              <div className="sm:col-span-2 space-y-4 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">🏷️ Thrift Sale Details</p>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sale Location / Address</label>
                  <input
                    type="text"
                    value={thriftAddress}
                    onChange={(e) => setThriftAddress(e.target.value)}
                    placeholder="e.g. 123 Main St, Faribault, MN 55021"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Open Hours</label>
                  <div className="space-y-2">
                    {thriftHours.map((row, i) => (
                      <div key={row.day} className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-gray-600 shrink-0">{row.day}</span>
                        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <input
                            type="checkbox"
                            checked={row.closed}
                            onChange={(e) => setThriftHours((h) => h.map((r, idx) => idx === i ? { ...r, closed: e.target.checked } : r))}
                            className="accent-green-600"
                          />
                          Closed
                        </label>
                        {!row.closed && (
                          <>
                            <input
                              type="time"
                              value={row.open}
                              onChange={(e) => setThriftHours((h) => h.map((r, idx) => idx === i ? { ...r, open: e.target.value } : r))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                              type="time"
                              value={row.close}
                              onChange={(e) => setThriftHours((h) => h.map((r, idx) => idx === i ? { ...r, close: e.target.value } : r))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </>
                        )}
                        {row.closed && <span className="text-xs text-gray-300 italic">Closed</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {form.type === "rental" && (
              <div className="sm:col-span-2">
                <RentalSetup
                  listingId={editingListing?.id ?? null}
                  supabase={supabase}
                  waiverUrl={rentalWaiverUrl ?? editingListing?.waiver_url ?? null}
                  waiverFilename={rentalWaiverFilename ?? editingListing?.waiver_filename ?? null}
                  vendorId={vendorId}
                  initialSettings={rentalSettings}
                  onWaiverUploaded={(url, name) => { setRentalWaiverUrl(url); setRentalWaiverFilename(name); }}
                  onDurationsChange={setRentalDurations}
                  onSettingsChange={setRentalSettings}
                />
              </div>
            )}

            {/* ── HOUSING FIELDS ── */}
            {(form.type === "housing_sale" || form.type === "housing_rent") && (
              <div className="sm:col-span-2 space-y-5 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  {form.type === "housing_sale" ? "🏠 Home For Sale Details" : "🏡 Rental Property Details"}
                </p>

                {/* Address */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Property Address</label>
                  <input type="text" value={housing.address}
                    onChange={(e) => setHousing((h) => ({ ...h, address: e.target.value }))}
                    placeholder="123 Main St, Faribault, MN 55021"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                {/* Beds / Baths / Sqft / Lot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Bedrooms", key: "bedrooms", placeholder: "3" },
                    { label: "Bathrooms", key: "bathrooms", placeholder: "2" },
                    { label: "Sq Ft", key: "sqft", placeholder: "1,400" },
                    { label: "Lot Size", key: "lot_size", placeholder: "0.25 acres" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input type="text" value={(housing as any)[key]}
                        onChange={(e) => setHousing((h) => ({ ...h, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  ))}
                </div>

                {/* Year built */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Year Built</label>
                    <input type="text" value={housing.year_built}
                      onChange={(e) => setHousing((h) => ({ ...h, year_built: e.target.value }))}
                      placeholder="1998"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  {form.type === "housing_rent" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Lease Term</label>
                      <select value={housing.lease_term}
                        onChange={(e) => setHousing((h) => ({ ...h, lease_term: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        {["Month-to-month", "6 months", "12 months", "18 months", "24 months"].map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {form.type === "housing_rent" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Available Date</label>
                    <input type="date" value={housing.available_date}
                      onChange={(e) => setHousing((h) => ({ ...h, available_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                )}

                {/* Feature toggles */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Features</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: "garage", label: "🚗 Garage" },
                      { key: "pets_allowed", label: "🐾 Pets Allowed" },
                      { key: "furnished", label: "🛋️ Furnished" },
                    ].map(({ key, label }) => (
                      <label key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${
                        (housing as any)[key] ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"
                      }`}>
                        <input type="checkbox" checked={(housing as any)[key]}
                          onChange={() => setHousing((h) => ({ ...h, [key]: !(h as any)[key] }))}
                          className="accent-green-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {form.type === "product" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantity in stock</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="Leave blank if unlimited"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                  </select>
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Describe this listing..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Photos <span className="font-normal text-gray-400">({images.length}/6 · first photo is the cover)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {images.map((url, i) => (
                  <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">Cover</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {i > 0 && (
                        <button onClick={() => moveImage(i, -1)} className="w-6 h-6 bg-white/80 rounded-full text-xs flex items-center justify-center hover:bg-white">←</button>
                      )}
                      {i < images.length - 1 && (
                        <button onClick={() => moveImage(i, 1)} className="w-6 h-6 bg-white/80 rounded-full text-xs flex items-center justify-center hover:bg-white">→</button>
                      )}
                      <button onClick={() => removeImage(url)} className="w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                    </div>
                  </div>
                ))}
                {images.length < 6 && (
                  <label className={`w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors shrink-0 ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploadingImage ? (
                      <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-2xl text-gray-300">+</span>
                        <span className="text-xs text-gray-400 mt-1">Add photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">JPG, PNG or WebP · max 5MB each · up to 6 photos · drag to reorder</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tags <span className="font-normal text-gray-400">(comma-separated)</span></label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. organic, local, fresh, gluten-free"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { onShowNew(false); onEdit(null); }}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {saveError && <p className="text-xs text-red-500 col-span-2">{saveError}</p>}
            <button
              onClick={saveListing}
              disabled={!form.title.trim() || saving || selectedCategories.length === 0}
              className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : editingListing ? "Save Changes" : "Create Listing"}
            </button>
          </div>
        </div>
      )}

      {/* Listings table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500">No listings yet. Add your first product or service.</p>
        </div>
      ) : (
        <>
        {/* Bulk category assignment bar */}
        {cats.length > 0 && selectedIds.size > 0 && (
          <div className="sticky top-14 lg:top-2 z-20 bg-green-600 text-white rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3 shadow-lg">
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>
            <select
              value=""
              onChange={(e) => { const v = e.target.value; if (!v) return; assignCategory([...selectedIds], v === "__none" ? null : v); setSelectedIds(new Set()); }}
              className="text-sm text-gray-800 rounded-lg px-2 py-1 bg-white focus:outline-none"
            >
              <option value="">Move to category…</option>
              <option value="__none">Uncategorized</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-sm underline hover:text-green-100">Clear</button>
          </div>
        )}

        {/* Mobile: card layout (table columns get cut off on phones) */}
        <div className="lg:hidden space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-2">
                {cats.length > 0 && (
                  <input type="checkbox" aria-label={`Select ${l.title}`} checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="mt-1 accent-green-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{l.type}{cats.length === 0 ? ` · ${catName(l.listing_category_id) ?? l.category}` : ""}</p>
                    </div>
                    <button
                      onClick={() => onToggle(l.id, l.is_active)}
                      className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${l.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {l.is_active ? "Active" : "Paused"}
                    </button>
                  </div>
                  {cats.length > 0 && (
                    <select
                      value={l.listing_category_id ?? ""}
                      onChange={(e) => assignCategory([l.id], e.target.value || null)}
                      className="mt-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-1.5 py-1 max-w-full focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="">Uncategorized</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{l.price ? formatPrice(l.price) : l.price_label ?? "—"}</span>
                <span>{l.quantity !== null ? (l.quantity === 0 ? "Out of stock" : `${l.quantity} in stock`) : "∞ stock"}</span>
                <span>👁 {l.view_count}</span>
                <span>🖱 {l.click_count}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => onEdit(l)} className="flex-1 min-w-[90px] text-sm bg-gray-900 text-white py-2 rounded-xl font-semibold hover:bg-gray-700 transition-colors">✏️ Edit</button>
                {l.type === "thrift" && (
                  <button onClick={() => markSold(l.id, !l.sold_at)} className={`flex-1 min-w-[110px] text-sm border py-2 rounded-xl font-semibold transition-colors ${l.sold_at ? "border-green-300 text-green-700 hover:bg-green-50" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{l.sold_at ? "↩ Mark Available" : "✓ Mark Sold"}</button>
                )}
                <button onClick={() => duplicateListing(l)} disabled={duplicatingId === l.id} className="flex-1 min-w-[90px] text-sm border border-gray-200 text-gray-600 py-2 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">{duplicatingId === l.id ? "…" : "⧉ Copy"}</button>
                <button onClick={() => setBoostListingId(l.id)} className="flex-1 min-w-[90px] text-sm border border-amber-300 text-amber-700 py-2 rounded-xl font-semibold hover:bg-amber-50 transition-colors">🚀 Boost</button>
                <button onClick={() => onDelete(l.id)} className="flex-1 min-w-[90px] text-sm border border-red-200 text-red-500 py-2 rounded-xl font-semibold hover:bg-red-50 transition-colors">🗑 Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: full table */}
        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {cats.length > 0 && (
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={listings.length > 0 && selectedIds.size === listings.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? new Set(listings.map((l) => l.id)) : new Set())}
                      className="accent-green-600"
                    />
                  </th>
                )}
                <th className="text-left px-6 py-3">Listing</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Views</th>
                <th className="text-right px-4 py-3">Clicks</th>
                <th className="text-right px-4 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listings.map((l) => (
                <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(l.id) ? "bg-green-50/50" : ""}`}>
                  {cats.length > 0 && (
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${l.title}`} checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="accent-green-600" />
                    </td>
                  )}
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{l.title}</p>
                    {cats.length > 0 ? (
                      <select
                        value={l.listing_category_id ?? ""}
                        onChange={(e) => assignCategory([l.id], e.target.value || null)}
                        className="mt-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-1.5 py-0.5 max-w-[170px] focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Uncategorized</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400">{l.category}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-gray-500">{l.type}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {l.price ? formatPrice(l.price) : l.price_label ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {l.quantity !== null ? (
                      <span className={l.quantity === 0 ? "text-red-500 font-medium" : "text-gray-700"}>
                        {l.quantity === 0 ? "Out of stock" : l.quantity}
                      </span>
                    ) : <span className="text-gray-400">∞</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{l.view_count}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{l.click_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onToggle(l.id, l.is_active)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        l.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {l.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => onEdit(l)} className="text-xs text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => duplicateListing(l)} disabled={duplicatingId === l.id} className="text-xs text-gray-500 hover:underline disabled:opacity-50">{duplicatingId === l.id ? "…" : "Copy"}</button>
                      <button onClick={() => onDelete(l.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

// ── ANALYTICS TAB ─────────────────────────────────────────────
function RadialProgress({ pct, color, size = 80, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

function AnalyticsTab({ listings, stats, vendorId }: { listings: Listing[]; stats: { totalViews: number; totalClicks: number }; vendorId: string }) {
  const supabase = createClient();
  const [localScore, setLocalScore] = useState(0);
  const [productsSold, setProductsSold] = useState(0);

  useEffect(() => {
    supabase.from("vendors").select("local_score,products_sold").eq("id", vendorId).single()
      .then(({ data }) => { if (data) { setLocalScore(data.local_score ?? 0); setProductsSold(data.products_sold ?? 0); } });
  }, [vendorId]);

  const conversionRate = stats.totalViews > 0 ? ((stats.totalClicks / stats.totalViews) * 100) : 0;
  const topListings = [...listings].sort((a, b) => b.view_count - a.view_count).slice(0, 5);
  const maxViews = topListings[0]?.view_count || 1;

  // Bucks tier labels
  const bucksTier = localScore >= 500 ? "🏆 Legend" : localScore >= 200 ? "🌟 Pro" : localScore >= 50 ? "🌱 Active" : "🆕 Getting Started";
  const nextMilestone = localScore >= 500 ? 500 : localScore >= 200 ? 500 : localScore >= 50 ? 200 : 50;
  const bucksPct = Math.min((localScore / nextMilestone) * 100, 100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

      {/* Local Bucks + Products Sold hero row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Local Bucks */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 flex items-center gap-5">
          <div className="relative shrink-0">
            <RadialProgress pct={bucksPct} color="#16a34a" size={88} stroke={8} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black text-green-700">🪙</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-0.5">Local Bucks</p>
            <p className="text-2xl font-black text-gray-900">{localScore} <span className="text-base font-semibold text-green-600">LB</span></p>
            <p className="text-sm font-semibold text-gray-600">{bucksTier}</p>
            <p className="text-xs text-gray-400 mt-1">{nextMilestone - localScore > 0 ? `${nextMilestone - localScore} LB to next level` : "Max level reached!"}</p>
            <p className="text-xs text-gray-400 mt-1">Login · Message · List = 1 LB &nbsp;|&nbsp; Sale = 2 LB</p>
            <a href="/local-bucks" target="_blank" className="text-xs text-green-600 hover:underline font-semibold mt-1 inline-block">What are Local Bucks? →</a>
          </div>
        </div>

        {/* Products Sold */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-5">
          <div className="relative shrink-0">
            <RadialProgress pct={Math.min(productsSold * 5, 100)} color="#d97706" size={88} stroke={8} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black text-amber-700">📦</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Products Sold</p>
            <p className="text-2xl font-black text-gray-900">{productsSold}</p>
            <p className="text-sm text-gray-500">Successful transactions</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Views circle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="relative shrink-0">
            <RadialProgress pct={Math.min((stats.totalViews / 500) * 100, 100)} color="#6366f1" size={64} stroke={6} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-600">👁️</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalViews.toLocaleString()}</p>
            <p className="text-sm font-medium text-gray-700">Profile Views</p>
            <p className="text-xs text-gray-400">All time</p>
          </div>
        </div>

        {/* Clicks circle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="relative shrink-0">
            <RadialProgress pct={Math.min((stats.totalClicks / 200) * 100, 100)} color="#0ea5e9" size={64} stroke={6} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-sky-500">🖱️</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalClicks.toLocaleString()}</p>
            <p className="text-sm font-medium text-gray-700">Total Clicks</p>
            <p className="text-xs text-gray-400">Across all listings</p>
          </div>
        </div>

        {/* CTR circle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="relative shrink-0">
            <RadialProgress pct={Math.min(conversionRate, 100)} color="#10b981" size={64} stroke={6} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-600">📈</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
            <p className="text-sm font-medium text-gray-700">Click-Through Rate</p>
            <p className="text-xs text-gray-400">Clicks ÷ Views</p>
          </div>
        </div>
      </div>

      {/* Top performing listings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Top Performing Listings</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ranked by views</p>
        </div>
        {topListings.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Add listings to see performance data.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {topListings.map((l, i) => {
              const ctr = l.view_count > 0 ? ((l.click_count / l.view_count) * 100).toFixed(1) : "0.0";
              return (
                <div key={l.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-300 w-5">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{l.title}</p>
                        <p className="text-xs text-gray-400">{l.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{l.view_count} views</p>
                      <p className="text-xs text-gray-400">{ctr}% CTR</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${(l.view_count / maxViews) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BOOKINGS TAB ──────────────────────────────────────────────
// Build a "prefill a new event" Google Calendar link (opens Google Calendar in a
// new tab with the appointment details filled in — no OAuth/setup required).
function googleCalendarUrl(b: Booking, vendorName: string): string {
  const start = b.scheduled_at ? new Date(b.scheduled_at) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const who = b.customer_name ?? b.buyer?.full_name ?? b.buyer?.email ?? "Customer";
  const title = b.title ? `${b.title} — ${who}` : `Appointment — ${who}`;
  const details = [
    b.customer_phone ? `Phone: ${b.customer_phone}` : "",
    b.notes ? `Notes: ${b.notes}` : "",
    `Booked via Everything Local (${vendorName})`,
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── RENTALS TAB ───────────────────────────────────────────────
function RentalsTab({ bookings, loading, onUpdateStatus }: {
  bookings: RentalBooking[]; loading: boolean; onUpdateStatus: (id: string, status: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState<string | null>(null);
  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  async function downloadWaiver(id: string) {
    setDownloading(id);
    try {
      const res = await fetch(`/api/rental/waiver-url?booking=${id}`);
      const json = await res.json();
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
      else alert(json.error ?? "No signed waiver available yet.");
    } catch {
      alert("Could not fetch the waiver.");
    }
    setDownloading(null);
  }

  function dateRange(b: RentalBooking) {
    const start = new Date(b.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (b.end_date && b.end_date !== b.start_date) {
      const end = new Date(b.end_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${start} – ${end}`;
    }
    return start;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rental Bookings</h1>
          <p className="text-gray-400 text-sm mt-0.5">{bookings.length} total · manage statuses and signed waivers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === s ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">🏕️</p>
          <p className="text-gray-500">No rental bookings yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">
                      {b.customer?.full_name ?? b.customer?.email ?? "Unknown customer"}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {b.status}
                    </span>
                  </div>
                  {b.listing && <p className="text-xs text-gray-500 mb-0.5">📦 {b.listing.title}</p>}
                  <p className="text-xs text-gray-500">📅 {dateRange(b)}{b.start_time && b.start_time !== "00:00" ? ` · ${b.start_time}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.duration_label} ({b.duration_hours}h)</p>
                  {(b.payment_status === "deposit_paid" || b.payment_status === "paid") && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">
                      💳 {b.payment_status === "paid" ? "Paid in full" : "Deposit paid"}{b.deposit_amount ? ` · ${formatPrice(b.deposit_amount)}` : ""}
                    </p>
                  )}
                  {b.notes && <p className="text-xs text-gray-400 mt-1 italic">&quot;{b.notes}&quot;</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{formatPrice(b.total_price)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {b.signed_waiver_pdf_url && (
                  <button
                    onClick={() => downloadWaiver(b.id)}
                    disabled={downloading === b.id}
                    className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-green-400 font-medium disabled:opacity-50"
                  >
                    {downloading === b.id ? "…" : "📄 Signed waiver"}
                  </button>
                )}
                {b.status === "pending" && (
                  <>
                    <button onClick={() => onUpdateStatus(b.id, "confirmed")} className="flex-1 min-w-[100px] bg-green-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">✓ Confirm</button>
                    <button onClick={() => onUpdateStatus(b.id, "cancelled")} className="flex-1 min-w-[100px] border border-red-200 text-red-500 text-xs py-2 rounded-lg font-medium hover:bg-red-50 transition-colors">✕ Cancel</button>
                  </>
                )}
                {b.status === "confirmed" && (
                  <button onClick={() => onUpdateStatus(b.id, "completed")} className="flex-1 min-w-[120px] bg-blue-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Mark as Completed</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OffersTab({ offers, loading, onUpdate }: {
  offers: ThriftOffer[]; loading: boolean; onUpdate: (id: string, status: string, counterAmount?: number) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = filter === "all" ? offers : offers.filter((o) => o.status === filter);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-red-100 text-red-700",
    countered: "bg-blue-100 text-blue-700",
  };

  function counter(o: ThriftOffer) {
    const input = window.prompt(`Counter offer for "${o.listing_title ?? "item"}" — enter your price ($):`, String(o.amount));
    if (input == null) return;
    const amt = Number(input);
    if (isNaN(amt) || amt <= 0) { alert("Enter a valid amount."); return; }
    onUpdate(o.id, "countered", amt);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
          <p className="text-gray-400 text-sm mt-0.5">{offers.length} total · accept, decline, or counter offers on your thrift items</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "accepted", "declined", "countered"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === s ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">🤝</p>
          <p className="text-gray-500">No offers yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{o.buyer_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {o.status}
                    </span>
                  </div>
                  {o.listing_title && <p className="text-xs text-gray-500 mb-0.5">🏷️ {o.listing_title}</p>}
                  <p className="text-xs text-gray-400"><a href={`mailto:${o.buyer_email}`} className="hover:underline">{o.buyer_email}</a></p>
                  {o.status === "countered" && o.counter_amount != null && (
                    <p className="text-xs text-blue-600 font-medium mt-0.5">Countered at {formatPrice(o.counter_amount)}</p>
                  )}
                  {o.message && <p className="text-xs text-gray-400 mt-1 italic">&quot;{o.message}&quot;</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{formatPrice(o.amount)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {o.status === "pending" && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => onUpdate(o.id, "accepted")} className="flex-1 min-w-[100px] bg-green-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">✓ Accept</button>
                  <button onClick={() => counter(o)} className="flex-1 min-w-[100px] bg-blue-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">↔ Counter</button>
                  <button onClick={() => onUpdate(o.id, "declined")} className="flex-1 min-w-[100px] border border-red-200 text-red-500 text-xs py-2 rounded-lg font-medium hover:bg-red-50 transition-colors">✕ Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingsTab({ bookings, loading, onUpdateStatus, onCreate, vendorName }: {
  bookings: Booking[]; loading: boolean; onUpdateStatus: (id: string, status: string) => void;
  onCreate: (input: { title: string; customer_name: string; customer_phone: string; scheduled_at: string; notes: string }) => Promise<{ ok: boolean; error?: string }>;
  vendorName: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <div className="flex flex-wrap items-center gap-2">
          {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === s ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setShowNew(true)}
            className="ml-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            + New Appointment
          </button>
        </div>
      </div>

      {showNew && (
        <NewAppointmentModal onClose={() => setShowNew(false)} onCreate={onCreate} />
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">No bookings yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm">
                      {b.customer_name ?? b.buyer?.full_name ?? b.buyer?.email ?? "Unknown buyer"}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {b.status}
                    </span>
                    {b.source === "manual" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Manual</span>
                    )}
                  </div>
                  {b.title && <p className="text-xs text-gray-700 font-medium mb-0.5">{b.title}</p>}
                  {b.listing && <p className="text-xs text-gray-500 mb-0.5">📦 {b.listing.title}</p>}
                  {b.customer_phone && (
                    <p className="text-xs text-gray-500">📞 <a href={`tel:${b.customer_phone}`} className="hover:text-green-600">{b.customer_phone}</a></p>
                  )}
                  {b.scheduled_at && (
                    <p className="text-xs text-gray-500">
                      📅 {new Date(b.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                  {b.notes && <p className="text-xs text-gray-400 mt-1 italic">"{b.notes}"</p>}
                  {b.scheduled_at && (
                    <a
                      href={googleCalendarUrl(b, vendorName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      📆 Add to Google Calendar
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {b.amount && <p className="font-bold text-gray-900">{formatPrice(b.amount)}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {b.status === "pending" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onUpdateStatus(b.id, "confirmed")}
                    className="flex-1 bg-green-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    ✓ Confirm
                  </button>
                  <button
                    onClick={() => onUpdateStatus(b.id, "cancelled")}
                    className="flex-1 border border-red-200 text-red-500 text-xs py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
                  >
                    ✕ Decline
                  </button>
                </div>
              )}
              {b.status === "confirmed" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onUpdateStatus(b.id, "completed")}
                    className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Mark as Completed
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NEW APPOINTMENT MODAL ─────────────────────────────────────
function NewAppointmentModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: { title: string; customer_name: string; customer_phone: string; scheduled_at: string; notes: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) { setError("Customer name is required."); return; }
    if (!date) { setError("Please pick a date."); return; }
    // Combine local date + time into an ISO timestamp
    const scheduled_at = new Date(`${date}T${time || "09:00"}`).toISOString();
    setSaving(true);
    const res = await onCreate({
      title: title.trim(),
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      scheduled_at,
      notes: notes.trim(),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Could not create the appointment."); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">New Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Service / title</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Roof estimate, Consultation"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Customer name <span className="text-red-500">*</span></label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phone number</label>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" placeholder="(715) 555-0123"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                value={date} onChange={(e) => setDate(e.target.value)}
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Time</label>
              <input
                value={time} onChange={(e) => setTime(e.target.value)}
                type="time"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Address, job details, anything to remember…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit} disabled={saving}
            className="flex-1 bg-green-600 text-white text-sm py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Create Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CRM TAB ───────────────────────────────────────────────────
function CRMTab({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter((c) =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-400 text-sm mt-0.5">{customers.length} total customers from completed bookings</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">
            {search ? "No customers match your search." : "Your customers will appear here after completed bookings."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Customer</th>
                <th className="text-right px-4 py-3">Bookings</th>
                <th className="text-right px-4 py-3">Total Spent</th>
                <th className="text-right px-6 py-3">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
                        {(c.full_name ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.full_name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-medium text-gray-700">{c.booking_count}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-green-700">
                    {c.total_spent > 0 ? formatPrice(c.total_spent) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-400">
                    {c.last_booking_at ? new Date(c.last_booking_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── REFERRALS TAB ─────────────────────────────────────────────
type Referral = {
  id: string;
  referred_id: string;
  converted: boolean;
  bucks_awarded: boolean;
  created_at: string;
  converted_at: string | null;
  referred: { full_name: string | null; email: string } | null;
};

type ReferredBy = {
  full_name: string | null;
  email: string;
  business_name: string | null;
  referral_code: string;
} | null;

// Compact one-click "copy my referral link" button for the overview header.
function ReferralCopyButton({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  if (!referralCode) return null;

  async function copy() {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${appUrl}/signup?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback for browsers/contexts without clipboard API
      const ta = document.createElement("textarea");
      ta.value = link; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title="Copy your referral link"
      className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700"
      }`}
    >
      {copied ? "✓ Copied!" : (
        <>
          <span className="hidden sm:inline">🔗 Referral Link</span>
          <span className="sm:hidden">🔗 Refer</span>
        </>
      )}
    </button>
  );
}

function ReferralsTab({ userId, referralCode, businessName }: {
  userId: string;
  referralCode: string;
  businessName: string;
}) {
  const supabase = createClient();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referredBy, setReferredBy] = useState<ReferredBy>(null);
  const [stats, setStats] = useState({ total: 0, converted: 0, bucksEarned: 0 });
  const [copied, setCopied] = useState<"profile" | "signup" | null>(null);
  const [loading, setLoading] = useState(true);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const slugifiedName = businessName.toLowerCase().replace(/\s+/g, "-");
  const profileLink = `${appUrl}/vendors/${slugifiedName}?ref=${referralCode}`;
  const signupLink = `${appUrl}/signup?ref=${referralCode}`;

  useEffect(() => {
    async function load() {
      const { data: refs } = await supabase
        .from("referrals")
        .select("*, referred:profiles!referred_id(full_name, email)")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      setReferrals((refs as Referral[]) ?? []);
      setStats({
        total: refs?.length ?? 0,
        converted: refs?.filter((r) => r.converted).length ?? 0,
        bucksEarned: (refs?.filter((r) => r.bucks_awarded).length ?? 0) * 50,
      });

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", userId)
        .single();

      if (myProfile?.referred_by) {
        const { data: referrer } = await supabase
          .from("profiles")
          .select("full_name, email, referral_code")
          .eq("id", myProfile.referred_by)
          .single();

        const { data: referrerVendor } = await supabase
          .from("vendors")
          .select("business_name")
          .eq("user_id", myProfile.referred_by)
          .single();

        if (referrer) {
          setReferredBy({
            full_name: referrer.full_name,
            email: referrer.email,
            business_name: referrerVendor?.business_name ?? null,
            referral_code: referrer.referral_code,
          });
        }
      }

      setLoading(false);
    }
    load();
  }, [supabase, userId]);

  function copyLink(type: "profile" | "signup") {
    navigator.clipboard.writeText(type === "profile" ? profileLink : signupLink);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-500 text-sm mt-1">
          Share your unique links — earn <span className="font-semibold text-amber-600">20 Local Bucks</span> for every person who signs up with your link.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Referred", value: stats.total, icon: "🤝" },
          { label: "Converted", value: stats.converted, icon: "✅" },
          { label: "LB Earned", value: `${stats.bucksEarned} 🪙`, icon: "💰" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral links */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Your Referral Links</h2>
        <p className="text-xs text-gray-400 mb-5">
          Each link is unique to you and fully trackable. When someone signs up through your link, the referral is logged automatically.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            📍 Storefront link — drive traffic to your business + track referrals
          </label>
          <div className="flex gap-2">
            <input readOnly value={profileLink}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 focus:outline-none font-mono" />
            <button onClick={() => copyLink("profile")}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${copied === "profile" ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}>
              {copied === "profile" ? "Copied! ✓" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Share with other vendors — when they copy <em>their</em> link while logged in, it auto-tags them as referred by you.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            ✍️ Signup link — refer new vendors or buyers directly
          </label>
          <div className="flex gap-2">
            <input readOnly value={signupLink}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 focus:outline-none font-mono" />
            <button onClick={() => copyLink("signup")}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${copied === "signup" ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}>
              {copied === "signup" ? "Copied! ✓" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-5 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">How it works:</p>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
            <li>You share your link with another vendor or buyer</li>
            <li>They sign up — automatically tagged as your referral</li>
            <li>You earn <strong>20 Local Bucks</strong> — automatically, instantly</li>
          </ol>
        </div>
      </div>

      {/* Who referred me */}
      {referredBy && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">You were referred by</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0">
              {(referredBy.full_name ?? referredBy.email)[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{referredBy.full_name ?? "—"}</p>
              {referredBy.business_name && <p className="text-xs text-green-600">{referredBy.business_name}</p>}
              <p className="text-xs text-gray-400">{referredBy.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* People I referred */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">People You've Referred</h2>
          <span className="text-xs text-gray-400">{referrals.length} total</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-gray-500 text-sm mb-2">No referrals yet.</p>
            <p className="text-gray-400 text-xs">Share your links above to start earning Local Bucks.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {referrals.map((r) => {
              const person = Array.isArray(r.referred) ? r.referred[0] : r.referred;
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0 text-sm">
                    {(person?.full_name ?? person?.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{person?.full_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{person?.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      r.bucks_awarded ? "bg-green-100 text-green-700"
                      : r.converted ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                    }`}>
                      {r.bucks_awarded ? "🪙 +20 LB earned" : r.converted ? "Converted" : "Pending"}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── STORE SETTINGS TAB ────────────────────────────────────────
const CATEGORIES_LIST = [
  "Products","Services & Trades","Restaurants & Food","Events & Rentals",
  "Health & Beauty","Home & Garden","Clothing & Accessories","Arts & Crafts",
  "Sports & Outdoors","Auto & Transportation","Pet Services","Childcare & Education",
  "Housing & Rentals",
];

function StoreSettingsTab({ vendor, supabase }: { vendor: any; supabase: any }) {
  const [showBoost, setShowBoost] = useState(false);
  const [businessName, setBusinessName] = useState(vendor.business_name ?? "");
  const [description, setDescription] = useState(vendor.description ?? "");
  const [category, setCategory] = useState(vendor.category ?? "");
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [website, setWebsite] = useState(vendor.website ?? "");
  const [address, setAddress] = useState(vendor.address ?? "");
  const [city, setCity] = useState(vendor.city ?? "");
  const [vendorState, setVendorState] = useState(vendor.state ?? "");
  // Up to 10 service locations (towns/cities served) for SEO + LocalBusiness schema
  const [serviceLocations, setServiceLocations] = useState<string[]>(() => {
    const existing: string[] = Array.isArray(vendor.service_locations) ? vendor.service_locations : [];
    return Array.from({ length: 10 }, (_, i) => existing[i] ?? "");
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(vendor.logo_url);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(vendor.banner_url);
  const [bannerPosition, setBannerPosition] = useState<number>(vendor.banner_position ?? 50);
  const bannerDragRef = useRef<{ startY: number; startPos: number } | null>(null);
  // Facebook-style drag-to-reposition: dragging the cover down reveals the top.
  function onBannerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    bannerDragRef.current = { startY: e.clientY, startPos: bannerPosition };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onBannerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = bannerDragRef.current;
    if (!d) return;
    const h = e.currentTarget.clientHeight || 160;
    const next = d.startPos - ((e.clientY - d.startY) / h) * 100;
    setBannerPosition(Math.max(0, Math.min(100, Math.round(next))));
  }
  function onBannerPointerUp() { bannerDragRef.current = null; }
  const [logoZoom, setLogoZoom] = useState<number>(vendor.logo_zoom ?? 1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Store Features ─────────────────────────────────────────────
  const [menuEnabled, setMenuEnabled] = useState(!!(vendor.menu_pdf_url));
  const [menuPdfUrl, setMenuPdfUrl] = useState<string | null>(vendor.menu_pdf_url ?? null);
  const [menuPdfFile, setMenuPdfFile] = useState<File | null>(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const menuPdfRef = useRef<HTMLInputElement>(null);

  const initCta = vendor.cta_button ?? {};
  const [ctaAction, setCtaAction] = useState<"none" | "call" | "estimate" | "order">(initCta.action ?? "none");
  const [ctaOrderUrl, setCtaOrderUrl] = useState<string>(initCta.url ?? "");
  const [featurePhone, setFeaturePhone] = useState(vendor.phone ?? "");
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureSaved, setFeatureSaved] = useState(false);

  async function uploadMenuPdf(file: File) {
    setMenuError(null);
    // Validate (phones sometimes report an empty MIME type — fall back to the name).
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setMenuError("Please choose a PDF file."); return; }
    if (file.size > 15 * 1024 * 1024) { setMenuError("That PDF is over 15MB — please upload a smaller file."); return; }

    setMenuUploading(true);
    // Unique filename → always an INSERT. (Re-uploading to a fixed path is a
    // storage UPDATE, which RLS blocks because the folder is the vendor id, not
    // the user id — that's why "Replace PDF" silently failed.)
    const path = `${vendor.id}/menu-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("vendor-logos").upload(path, file, { contentType: "application/pdf", cacheControl: "3600" });
    if (error) { setMenuError("Upload failed: " + error.message); setMenuUploading(false); return; }

    const url = supabase.storage.from("vendor-logos").getPublicUrl(path).data.publicUrl;
    const { error: dbErr } = await supabase.from("vendors").update({ menu_pdf_url: url }).eq("id", vendor.id);
    if (dbErr) { setMenuError("Uploaded, but couldn't save it to your store: " + dbErr.message); setMenuUploading(false); return; }

    setMenuPdfUrl(url);
    setMenuEnabled(true);
    setMenuUploading(false);
  }

  async function saveFeatures() {
    setFeatureSaving(true);
    const updates: Record<string, unknown> = {
      menu_pdf_url: menuEnabled ? menuPdfUrl : null,
      cta_button: ctaAction === "none" ? null : {
        action: ctaAction,
        ...(ctaAction === "order" && ctaOrderUrl.trim() ? { url: ctaOrderUrl.trim() } : {}),
      },
    };
    if (ctaAction === "call") updates.phone = featurePhone.trim() || null;
    await supabase.from("vendors").update(updates).eq("id", vendor.id);
    // Keep main phone field in sync
    if (ctaAction === "call") setPhone(featurePhone);
    setFeatureSaving(false); setFeatureSaved(true); setTimeout(() => setFeatureSaved(false), 3000);
  }
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setLogoFile(f); setLogoPreview(URL.createObjectURL(f));
  }
  function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBannerFile(f); setBannerPreview(URL.createObjectURL(f));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    let logoUrl = vendor.logo_url;
    let bannerUrl = vendor.banner_url;
    if (logoFile) {
      // Unique filename → always an INSERT. A fixed-path re-upload is a storage
      // UPDATE, which RLS blocks (the folder is the vendor id, not auth.uid()),
      // so "Change logo" silently failed on replace. Insert-only sidesteps that.
      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const logoPath = `${vendor.id}/logo-${Date.now()}.${ext}`;
      const { error: err } = await supabase.storage.from("vendor-logos").upload(logoPath, logoFile, { cacheControl: "3600" });
      if (err) { setError("Logo upload failed: " + err.message); setSaving(false); return; }
      logoUrl = supabase.storage.from("vendor-logos").getPublicUrl(logoPath).data.publicUrl;
    }
    if (bannerFile) {
      const ext = (bannerFile.name.split(".").pop() || "jpg").toLowerCase();
      const bannerPath = `${vendor.id}/banner-${Date.now()}.${ext}`;
      const { error: err } = await supabase.storage.from("vendor-banners").upload(bannerPath, bannerFile, { cacheControl: "3600" });
      if (err) { setError("Banner upload failed: " + err.message); setSaving(false); return; }
      bannerUrl = supabase.storage.from("vendor-banners").getPublicUrl(bannerPath).data.publicUrl;
    }
    // Regenerate slug if business name changed
    let newSlug = vendor.slug;
    const trimmedName = businessName.trim();
    if (trimmedName !== vendor.business_name) {
      const base = slugify(trimmedName);
      // Find a unique slug by appending a short random suffix if needed
      const { data: existing } = await supabase
        .from("vendors").select("id").eq("slug", base).neq("id", vendor.id).maybeSingle();
      newSlug = existing ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    }

    const { error: updateErr } = await supabase.from("vendors").update({
      business_name: trimmedName,
      slug: newSlug,
      description: description.trim() || null,
      category,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      city: city.trim(),
      state: vendorState.trim(),
      service_locations: serviceLocations.map((s) => s.trim()).filter(Boolean),
      logo_url: logoUrl,
      banner_url: bannerUrl,
      banner_position: bannerPosition,
      banner_zoom: 1,
      logo_zoom: logoZoom,
    }).eq("id", vendor.id);
    if (updateErr) { setError(updateErr.message); } else {
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      // Re-geocode map coordinates when the address changed (fire-and-forget).
      if (address.trim() && address.trim() !== (vendor.address ?? "")) {
        fetch("/api/vendors/geocode", { method: "POST" }).catch(() => {});
      }
      // Redirect to the new URL if the slug changed
      if (newSlug !== vendor.slug) {
        window.location.href = `/dashboard/vendor`;
      }
    }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Store Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Edit your public storefront — changes are live immediately.</p>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Cover photo</label>
          <p className="text-xs text-gray-400 mb-2">The big banner across the top of your public page. If you skip it, we use your first product photo automatically. <span className="text-gray-500 font-medium">Best size: 1600 × 500 px</span> (a wide 3.2:1 photo).</p>
          {bannerPreview ? (
            <>
              {/* Frame matches the public hero (wide) so what you see is what shows */}
              <div
                onPointerDown={onBannerPointerDown}
                onPointerMove={onBannerPointerMove}
                onPointerUp={onBannerPointerUp}
                onPointerCancel={onBannerPointerUp}
                className="relative w-full aspect-[16/6] rounded-2xl overflow-hidden bg-gray-100 cursor-grab active:cursor-grabbing select-none touch-none"
              >
                <img src={bannerPreview} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ objectPosition: `center ${bannerPosition}%` }} />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none">↕ Drag to reposition</div>
              </div>
              <div className="mt-3">
                <label className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1">
                  <span>Reposition (up / down)</span>
                  <span className="text-gray-400">{bannerPosition < 34 ? "Top" : bannerPosition > 66 ? "Bottom" : "Center"}</span>
                </label>
                <input
                  type="range" min={0} max={100} step={1} value={bannerPosition}
                  onChange={(e) => setBannerPosition(Number(e.target.value))}
                  className="w-full accent-green-600"
                />
              </div>
              <button type="button" onClick={() => bannerRef.current?.click()} className="mt-2 text-sm text-green-600 font-medium hover:underline">Change cover photo</button>
            </>
          ) : (
            <div onClick={() => bannerRef.current?.click()} className="w-full aspect-[16/6] rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 hover:border-green-400 cursor-pointer transition-colors flex items-center justify-center">
              <span className="text-gray-400 text-sm">Click to upload a cover photo · 1600 × 500 px</span>
            </div>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={onBannerChange} />
        </div>
        <div className="flex items-center gap-4">
          <div onClick={() => logoRef.current?.click()} className={`w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-green-700 overflow-hidden cursor-pointer ring-2 ring-green-100 hover:ring-green-400 transition-all shrink-0 ${logoPreview ? "bg-white" : "bg-green-100"}`}>
            {logoPreview
              ? <img src={logoPreview} alt="" className="w-full h-full object-contain transition-transform" style={{ transform: `scale(${logoZoom})` }} />
              : businessName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => logoRef.current?.click()} className="text-sm text-green-600 font-medium hover:underline">Change logo</button>
            <p className="text-xs text-gray-400 mt-0.5">Square works best — <span className="text-gray-500 font-medium">400 × 400 px</span>. Use zoom to make it fit.</p>
            {logoPreview && (
              <div className="mt-2">
                <label className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1">
                  <span>🔍 Zoom to fit</span>
                  <span className="text-gray-400">{Math.round(logoZoom * 100)}%</span>
                </label>
                <input
                  type="range" min={0.5} max={2} step={0.05} value={logoZoom}
                  onChange={(e) => setLogoZoom(Number(e.target.value))}
                  className="w-full accent-green-600"
                />
              </div>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Business name</label>
          <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Tell customers what makes your business special..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
            <option value="">Select a category</option>
            {CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Eau Claire" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
            <input type="text" value={vendorState} onChange={(e) => setVendorState(e.target.value)} placeholder="WI" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Street address <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(715) 555-0000" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Website <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourbusiness.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        {/* ── SERVICE LOCATIONS (SEO + schema) ─────────────────────── */}
        <div className="border border-gray-200 rounded-2xl p-5 bg-white">
          <label className="block text-sm font-semibold text-gray-700">Service Locations</label>
          <p className="text-xs text-gray-400 mt-0.5 mb-3">
            List up to 10 cities or towns you serve. These appear on your public page and power local-SEO search schema so nearby customers can find you.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {serviceLocations.map((loc, i) => (
              <input
                key={i}
                value={loc}
                onChange={(e) => setServiceLocations((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                placeholder={`Location ${i + 1}${i === 0 ? " (e.g. Eau Claire, WI)" : ""}`}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}
        <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${saved ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save store settings"}
        </button>
      </form>
      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-500">Your public storefront: <a href={`/vendors/${vendor.slug}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline font-medium">/vendors/{vendor.slug}</a></p>
      </div>

      {showBoost && (
        <BoostModal
          entityType="vendor"
          entityId={vendor.id}
          homepageLabel="New Businesses"
          returnPath="/dashboard/vendor?tab=store"
          onClose={() => setShowBoost(false)}
        />
      )}

      {/* ── BOOST / FEATURE ─────────────────────────────────────── */}
      <div className="mt-8 border-t border-gray-100 pt-8">
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">🚀 Boost your business</p>
            <p className="text-xs text-gray-500 mt-0.5">Feature in <strong>New Businesses</strong> on the homepage ($5/mo) or pin to your town's <strong>Local Pages</strong> ($10/mo). Cancel anytime.</p>
          </div>
          <button type="button" onClick={() => setShowBoost(true)} className="shrink-0 bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors">
            Boost →
          </button>
        </div>
      </div>

      {/* ── STORE FEATURES ─────────────────────────────────────── */}
      <div className="mt-8 border-t border-gray-100 pt-8 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Store Features</h3>
          <p className="text-sm text-gray-400 mt-0.5">Toggle optional features that appear on your public store page.</p>
        </div>

        {/* Menu PDF */}
        <div className={`border rounded-2xl p-5 transition-colors ${menuEnabled ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">🍽️ Menu PDF</p>
              <p className="text-xs text-gray-400 mt-0.5">Show a "View Menu" button on your page linking to a PDF menu.</p>
            </div>
            <button
              type="button"
              onClick={() => setMenuEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ${menuEnabled ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${menuEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {menuEnabled && (
            <div className="mt-4 space-y-3">
              {menuPdfUrl && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                  <span>📄</span>
                  <a href={menuPdfUrl} target="_blank" rel="noreferrer" className="underline truncate">{menuPdfUrl.split("/").pop()}</a>
                </div>
              )}
              <div>
                <input ref={menuPdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMenuPdfFile(f); uploadMenuPdf(f); } e.target.value = ""; }} />
                <button type="button" disabled={menuUploading} onClick={() => menuPdfRef.current?.click()} className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
                  {menuUploading ? "Uploading…" : menuPdfUrl ? "Replace PDF" : "Upload PDF"}
                </button>
                <p className="text-xs text-gray-400 mt-1">PDF format, max 15MB · saves instantly</p>
                {menuError && <p className="text-xs text-red-500 mt-1.5">{menuError}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Contact Action */}
        <div className="border border-gray-200 bg-white rounded-2xl p-5">
          <p className="font-semibold text-gray-900 text-sm mb-1">🔘 Contact Action Button</p>
          <p className="text-xs text-gray-400 mb-4">Choose what appears in the Contact dropdown on your store page. Message is always shown separately.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { value: "none",     label: "None",                   icon: "—" },
              { value: "call",     label: "Call",                   icon: "📞" },
              { value: "estimate", label: "Request Free Estimate",  icon: "📋" },
              { value: "order",    label: "Order Now",              icon: "🛒" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCtaAction(opt.value)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                  ctaAction === opt.value
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-green-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
          {ctaAction === "estimate" && (
            <p className="text-xs text-gray-400 mt-3">A form will pop up collecting the customer's name, email, phone, and message. Responses go to your bookings inbox.</p>
          )}
          {ctaAction === "order" && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Order link <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={ctaOrderUrl}
                  onChange={(e) => setCtaOrderUrl(e.target.value)}
                  placeholder="https://your-ordering-site.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <p className="text-xs text-gray-400">
                {ctaOrderUrl.trim()
                  ? "Customers will be sent to this URL when they click Order Now."
                  : "Leave blank to use the built-in order form instead."}
              </p>
            </div>
          )}
          {ctaAction === "call" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone number customers will call</label>
              <input
                type="tel"
                value={featurePhone}
                onChange={(e) => setFeaturePhone(e.target.value)}
                placeholder="(715) 555-0000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={saveFeatures}
          disabled={featureSaving}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${featureSaved ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}
        >
          {featureSaving ? "Saving features…" : featureSaved ? "✓ Features saved!" : "Save store features"}
        </button>
      </div>

    </div>
  );
}

/* ─── PAGE BLOCKS EDITOR ─────────────────────────────────────────── */
type PageBlock = {
  id: string; image_url: string; text: string;
  font_size: "sm" | "base" | "lg" | "xl" | "2xl";
  color: string; bold: boolean;
  align: "left" | "center" | "right";
  layout: "image-left" | "image-right" | "image-top" | "image-only";
};

function PageBlocksEditor({ vendorId, initialBlocks, supabase }: { vendorId: string; initialBlocks: PageBlock[]; supabase: any }) {
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function uploadImage(blockId: string, file: File) {
    setUploading(blockId);
    const ext = file.name.split(".").pop();
    const path = `${vendorId}/blocks/${blockId}.${ext}`;
    const { error } = await supabase.storage.from("vendor-logos").upload(path, file, { upsert: true });
    if (!error) {
      const url = supabase.storage.from("vendor-logos").getPublicUrl(path).data.publicUrl;
      setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, image_url: url } : b));
    }
    setUploading(null);
  }

  function addBlock() {
    const id = crypto.randomUUID();
    setBlocks((prev) => [...prev, { id, image_url: "", text: "", font_size: "lg", color: "#111827", bold: false, align: "left", layout: "image-left" }]);
  }

  function removeBlock(id: string) { setBlocks((prev) => prev.filter((b) => b.id !== id)); }

  function updateBlock(id: string, patch: Partial<PageBlock>) { setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b)); }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function saveBlocks() {
    setSaving(true);
    await supabase.from("vendors").update({ page_blocks: blocks }).eq("id", vendorId);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mt-10 border-t border-gray-100 pt-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Page Content Blocks</h3>
          <p className="text-sm text-gray-400 mt-0.5">Add photos with text to your public business page. Drag to reorder.</p>
        </div>
        <button onClick={addBlock} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl font-semibold hover:bg-gray-700 transition-colors">+ Add Block</button>
      </div>

      {blocks.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl py-10 text-center text-gray-400 text-sm">
          No content blocks yet. Add photos and text to make your page stand out.
        </div>
      )}

      <div className="space-y-6 mt-4">
        {blocks.map((block, idx) => (
          <div key={block.id} className="border border-gray-100 rounded-2xl p-5 bg-gray-50 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Block {idx + 1}</span>
              <div className="flex gap-2">
                {idx > 0 && <button onClick={() => moveBlock(block.id, -1)} className="text-xs text-gray-400 hover:text-gray-700 px-2">↑</button>}
                {idx < blocks.length - 1 && <button onClick={() => moveBlock(block.id, 1)} className="text-xs text-gray-400 hover:text-gray-700 px-2">↓</button>}
                <button onClick={() => removeBlock(block.id)} className="text-xs text-red-400 hover:text-red-600 px-2">Remove</button>
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Photo</label>
              <div
                onClick={() => fileRefs.current[block.id]?.click()}
                className="w-full h-40 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 hover:border-green-400 cursor-pointer transition-colors flex items-center justify-center relative"
              >
                {block.image_url
                  ? <img src={block.image_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-gray-400 text-sm">{uploading === block.id ? "Uploading..." : "Click to upload photo"}</span>}
              </div>
              <input
                ref={(el) => { fileRefs.current[block.id] = el; }}
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(block.id, f); }}
              />
            </div>

            {/* Layout */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Layout</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["image-left", "image-right", "image-top", "image-only"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => updateBlock(block.id, { layout: l })}
                    className={`text-xs py-2 rounded-xl border font-medium transition-colors ${block.layout === l ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                    {l === "image-left" ? "← Photo" : l === "image-right" ? "Photo →" : l === "image-top" ? "Photo ↑" : "Full Photo"}
                  </button>
                ))}
              </div>
            </div>

            {/* Text (hidden for image-only) */}
            {block.layout !== "image-only" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Caption / Text</label>
                <textarea value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} rows={3}
                  placeholder="Add a caption, tagline, or story..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />

                {/* Text style controls */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Size</label>
                    <select value={block.font_size} onChange={(e) => updateBlock(block.id, { font_size: e.target.value as any })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="sm">Small</option>
                      <option value="base">Normal</option>
                      <option value="lg">Large</option>
                      <option value="xl">X-Large</option>
                      <option value="2xl">2X-Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={block.color} onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                      <input type="text" value={block.color} onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Align</label>
                    <select value={block.align} onChange={(e) => updateBlock(block.id, { align: e.target.value as any })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Style</label>
                    <button type="button" onClick={() => updateBlock(block.id, { bold: !block.bold })}
                      className={`w-full py-1.5 rounded-lg border text-xs font-bold transition-colors ${block.bold ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                      Bold
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {blocks.length > 0 && (
        <button onClick={saveBlocks} disabled={saving}
          className={`mt-6 w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${saved ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}>
          {saving ? "Saving..." : saved ? "Saved! ✓" : "Save page blocks"}
        </button>
      )}
    </div>
  );
}

/* ─── MY PLACES TAB ─────────────────────────────────────────────────────── */
type MyPlace = { id: string; slug: string; name: string; type: string; city: string; state: string; is_active: boolean; images: string[] };

const PLACE_TYPE_LABEL: Record<string, string> = {
  park: "Park", campground: "Campground", attraction: "Attraction", thing_to_do: "Thing to Do", food_truck: "Food Truck",
};
const PLACE_TYPE_COLOR: Record<string, string> = {
  park: "bg-green-100 text-green-700", campground: "bg-blue-100 text-blue-700",
  attraction: "bg-purple-100 text-purple-700", thing_to_do: "bg-amber-100 text-amber-700", food_truck: "bg-orange-100 text-orange-700",
};

function MyPlacesTab({ userId }: { userId: string }) {
  const supabase = createClient();
  const [places, setPlaces] = useState<MyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("places").select("id,slug,name,type,city,state,is_active,images")
      .eq("created_by", userId).order("created_at", { ascending: false })
      .then(({ data }) => { setPlaces((data ?? []) as MyPlace[]); setLoading(false); });
  }, [userId]);

  async function handleDelete(place: MyPlace) {
    if (!confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    setDeleting(place.id);
    const res = await fetch("/api/places/cancel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: place.id }),
    });
    if (res.ok) {
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
    } else {
      const out = await res.json();
      alert(out.error ?? "Delete failed.");
    }
    setDeleting(null);
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🌿 My Places</h2>
          <p className="text-sm text-gray-400">Parks, campgrounds, attractions, food trucks you&apos;ve added</p>
        </div>
        <a href="/places/add" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          + Add a place
        </a>
      </div>

      {places.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">🌿</p>
          <p className="font-semibold text-gray-700 mb-1">No places yet</p>
          <p className="text-sm text-gray-400 mb-4">Add a park, campground, attraction, or food truck to get started.</p>
          <a href="/places/add" className="inline-block bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors">
            Add your first place
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {places.map((p) => (
            <div key={p.id} className={`bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 ${!p.is_active ? "opacity-60" : ""}`}>
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl shrink-0">🌿</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/places/${p.slug}`} target="_blank" rel="noreferrer"
                    className="font-semibold text-gray-900 hover:text-emerald-700 hover:underline truncate">
                    {p.name}
                  </a>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PLACE_TYPE_COLOR[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {PLACE_TYPE_LABEL[p.type] ?? p.type}
                  </span>
                  {!p.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium shrink-0">Inactive</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{p.city}, {p.state}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/places/${p.slug}/edit`}
                  className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 hover:border-blue-300 rounded-lg px-3 py-1.5 font-medium transition-colors">
                  Edit
                </a>
                <button onClick={() => handleDelete(p)} disabled={deleting === p.id}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
                  {deleting === p.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ADMIN: ALL BUSINESSES TAB ──────────────────────────────────────────── */
function AdminBusinessesTab() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  // Staged tier changes not yet written to the database — keyed by vendor id
  const [pendingTiers, setPendingTiers] = useState<Record<string, "free" | "premium" | "premium_plus">>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("vendors")
      .select("id,business_name,slug,tier,city,state,category,is_verified,is_claimed,is_active,logo_url,phone")
      .order("business_name")
      .then(({ data }) => { setVendors(data ?? []); setLoading(false); });
  }, []);

  // Stage a tier change locally; committed when Save is clicked
  function stageTier(vendorId: string, newTier: "free" | "premium" | "premium_plus", savedTier: string) {
    setSavedAt(null);
    setPendingTiers((prev) => {
      const next = { ...prev };
      // If the choice matches what's already in the DB, drop it from pending
      if (newTier === savedTier) delete next[vendorId];
      else next[vendorId] = newTier;
      return next;
    });
  }

  async function saveChanges() {
    const entries = Object.entries(pendingTiers);
    if (entries.length === 0) return;
    setSavingAll(true);
    await Promise.all(
      entries.map(([id, tier]) => supabase.from("vendors").update({ tier, features: featuresForTier(tier) }).eq("id", id))
    );
    setVendors((prev) => prev.map((v) => pendingTiers[v.id] ? { ...v, tier: pendingTiers[v.id] } : v));
    setPendingTiers({});
    setSavingAll(false);
    setSavedAt(Date.now());
  }

  const pendingCount = Object.keys(pendingTiers).length;

  async function togglePause(vendorId: string, nextActive: boolean) {
    setSaving(vendorId);
    await supabase.from("vendors").update({ is_active: nextActive }).eq("id", vendorId);
    setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, is_active: nextActive } : v));
    setSaving(null);
  }

  async function deleteVendor(vendor: any) {
    const confirmed = window.confirm(
      `Permanently delete "${vendor.business_name}"?\n\nThis removes the business and all its listings. This cannot be undone.`
    );
    if (!confirmed) return;
    setSaving(vendor.id);
    // Remove dependent listings first (in case no cascade is set)
    await supabase.from("listings").delete().eq("vendor_id", vendor.id);
    // Select the deleted rows back so we can tell a real delete apart from a
    // no-op that RLS silently blocked (0 rows, no error).
    const { data, error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", vendor.id)
      .select("id");
    if (error) {
      window.alert(`Could not delete: ${error.message}`);
      setSaving(null);
      return;
    }
    if (!data || data.length === 0) {
      window.alert(
        `"${vendor.business_name}" was not deleted. You may not have permission to remove businesses.`
      );
      setSaving(null);
      return;
    }
    setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
    setSaving(null);
  }

  const filtered = vendors.filter((v) =>
    !search ||
    v.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.city?.toLowerCase().includes(search.toLowerCase()) ||
    v.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">All Businesses</h2>
          <p className="text-sm text-gray-400">{vendors.length} total · {vendors.filter(v => v.tier === "premium_plus").length} Pro+ · {vendors.filter(v => v.tier === "premium").length} Pro · {vendors.filter(v => !v.is_claimed).length} unclaimed</p>
        </div>
        <a href="/admin" className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Full Admin →</a>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, city, or category..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Business</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membership</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shrink-0">
                        {v.logo_url
                          ? <img src={v.logo_url} alt="" className="w-full h-full object-contain" />
                          : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-400">{v.business_name?.[0]}</div>}
                      </div>
                      <div className="min-w-0">
                        <a href={`/vendors/${v.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-green-600 truncate block max-w-[140px] md:max-w-[200px]">
                          {v.business_name}
                        </a>
                        <p className="text-xs text-gray-400 truncate">{v.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{v.city}, {v.state}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-col gap-1 items-start">
                      {v.is_claimed
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Claimed</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⏳ Unclaimed</span>}
                      {v.is_active === false && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">⏸ Paused</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={pendingTiers[v.id] ?? (v.tier === "premium_plus" ? "premium_plus" : v.tier === "premium" ? "premium" : "free")}
                      onChange={(e) => stageTier(v.id, e.target.value as "free" | "premium" | "premium_plus", v.tier)}
                      disabled={saving === v.id || savingAll}
                      className={`text-xs font-semibold border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40 cursor-pointer ${
                        pendingTiers[v.id]
                          ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200"
                          : (v.tier === "premium_plus" ? "bg-purple-50 border-purple-300 text-purple-700" : v.tier === "premium" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-600")
                      }`}
                    >
                      <option value="free">Free</option>
                      <option value="premium">⭐ Local Pro</option>
                      <option value="premium_plus">💎 Local Pro+</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => togglePause(v.id, v.is_active === false)}
                        disabled={saving === v.id}
                        title={v.is_active === false ? "Make this business live again" : "Hide this business from the site"}
                        className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 ${
                          v.is_active === false
                            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {v.is_active === false ? "▶ Activate" : "⏸ Pause"}
                      </button>
                      <button
                        onClick={() => deleteVendor(v)}
                        disabled={saving === v.id}
                        title="Permanently delete this business"
                        className="text-xs font-semibold border border-red-200 bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition-colors disabled:opacity-40"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No businesses found</p>}
        </div>
      )}

      {/* Save bar — commits staged membership changes */}
      {!loading && (
        <div className="flex items-center justify-end gap-3 mt-4">
          {pendingCount > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}
            </span>
          )}
          {savedAt && pendingCount === 0 && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
          <button
            onClick={saveChanges}
            disabled={pendingCount === 0 || savingAll}
            className="text-sm font-semibold bg-green-600 text-white rounded-xl px-5 py-2.5 hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingAll ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// Admin-only bulk manager for the green call-to-action button on every listing.
// Mirrors AdminBusinessesTab: search, a per-row dropdown, staged edits, one Save.
// "Auto" = no saved cta_type; the button falls back to the type-based default.
function AdminListingsTab() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Staged cta_type edits, keyed by listing id. "" means Auto (null in the DB).
  const [pending, setPending] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("listings")
      .select("id,title,type,category,cta_type,is_active,is_featured,images,vendor:vendors(id,business_name,slug,phone,menu_pdf_url,logo_url)")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  // Change a business's profile photo (logo) right from this table.
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTarget = useRef<string | null>(null);
  const [uploadingVendor, setUploadingVendor] = useState<string | null>(null);

  function pickLogo(vendorId: string) {
    uploadTarget.current = vendorId;
    logoInputRef.current?.click();
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const vendorId = uploadTarget.current;
    e.target.value = "";
    if (!file || !vendorId) return;
    setUploadingVendor(vendorId);
    const ext = file.name.split(".").pop() || "png";
    const path = `${vendorId}/logo.${ext}`;
    const { error } = await supabase.storage.from("vendor-logos").upload(path, file, { upsert: true });
    if (!error) {
      const base = supabase.storage.from("vendor-logos").getPublicUrl(path).data.publicUrl;
      const url = `${base}?t=${Date.now()}`; // cache-bust so the new logo shows everywhere
      await supabase.from("vendors").update({ logo_url: url, banner_url: url }).eq("id", vendorId);
      setRows((prev) => prev.map((r) => {
        const rv = Array.isArray(r.vendor) ? r.vendor[0] : r.vendor;
        if (rv?.id !== vendorId) return r;
        const nv = { ...rv, logo_url: url };
        return { ...r, vendor: Array.isArray(r.vendor) ? [nv] : nv };
      }));
    }
    setUploadingVendor(null);
  }

  function stage(id: string, value: string, savedValue: string) {
    setSavedAt(null);
    setPending((prev) => {
      const next = { ...prev };
      if (value === savedValue) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  async function saveChanges() {
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    setSavingAll(true);
    await Promise.all(
      entries.map(([id, cta]) => supabase.from("listings").update({ cta_type: cta === "" ? null : cta }).eq("id", id))
    );
    setRows((prev) => prev.map((r) => (r.id in pending ? { ...r, cta_type: pending[r.id] === "" ? null : pending[r.id] } : r)));
    setPending({});
    setSavingAll(false);
    setSavedAt(Date.now());
  }

  const pendingCount = Object.keys(pending).length;

  // Change a listing's own primary photo (separate from the business logo).
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoTarget = useRef<{ listingId: string; vendorId: string; images: string[] } | null>(null);

  function pickListingPhoto(listingId: string, vendorId: string, images: string[]) {
    photoTarget.current = { listingId, vendorId, images: images ?? [] };
    photoInputRef.current?.click();
  }

  async function onListingPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const t = photoTarget.current;
    e.target.value = "";
    if (!file || !t) return;
    setRowBusy(t.listingId);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${t.vendorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
    if (!error) {
      const url = supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
      const nextImages = [url, ...(t.images ?? []).slice(1)]; // replace the primary photo
      await supabase.from("listings").update({ images: nextImages }).eq("id", t.listingId);
      setRows((prev) => prev.map((r) => r.id === t.listingId ? { ...r, images: nextImages } : r));
    }
    setRowBusy(null);
  }

  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function togglePause(id: string, nextActive: boolean) {
    setRowBusy(id);
    await supabase.from("listings").update({ is_active: nextActive }).eq("id", id);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, is_active: nextActive } : r));
    setRowBusy(null);
  }

  async function toggleFeature(id: string, nextFeatured: boolean) {
    setRowBusy(id);
    await supabase.from("listings").update({ is_featured: nextFeatured }).eq("id", id);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, is_featured: nextFeatured } : r));
    setRowBusy(null);
  }

  async function deleteListing(r: any) {
    if (!confirm(`Permanently delete "${r.title}"? This cannot be undone.`)) return;
    setRowBusy(r.id);
    const { error } = await supabase.from("listings").delete().eq("id", r.id);
    if (error) { alert(`Could not delete: ${error.message}`); setRowBusy(null); return; }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    setRowBusy(null);
  }

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const v = Array.isArray(r.vendor) ? r.vendor[0] : r.vendor;
    const hay = `${r.title} ${v?.business_name ?? ""} ${r.category}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-gray-900">All Listings</h2>
          <p className="text-sm text-gray-400">{rows.length} listings · set the green button each one shows. Free Estimate is meant for services & trades.</p>
        </div>
        <a href="/admin" className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Full Admin →</a>
      </div>

      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onListingPhotoFile} />

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by listing, business, or category..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Listing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Button</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const v = Array.isArray(r.vendor) ? r.vendor[0] : r.vendor;
                const current = pending[r.id] ?? (r.cta_type ?? "");
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => v?.id && pickLogo(v.id)}
                          title="Change business logo"
                          className="relative w-9 h-9 rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0 group"
                        >
                          {v?.logo_url
                            ? <img src={v.logo_url} alt="" className="w-full h-full object-contain" />
                            : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">{v?.business_name?.[0] ?? "?"}</span>}
                          <span className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingVendor === v?.id ? "…" : "Edit"}
                          </span>
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[140px] md:max-w-[220px]">{r.title}</p>
                          <a href={v?.slug ? `/vendors/${v.slug}` : "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-green-600 truncate block max-w-[140px] md:max-w-[220px]">{v?.business_name ?? "—"}</a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{r.category}</td>
                    <td className="px-4 py-3">
                      <select
                        value={current}
                        onChange={(e) => stage(r.id, e.target.value, r.cta_type ?? "")}
                        disabled={savingAll}
                        className={`text-xs font-semibold border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40 cursor-pointer ${
                          r.id in pending ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        <option value="">Auto (by type)</option>
                        {LISTING_CTA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => v?.id && pickListingPhoto(r.id, v.id, r.images ?? [])}
                          disabled={rowBusy === r.id}
                          title="Change listing photo"
                          className="text-xs font-semibold border border-gray-200 bg-white text-gray-500 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          📷
                        </button>
                        <button
                          onClick={() => toggleFeature(r.id, !r.is_featured)}
                          disabled={rowBusy === r.id}
                          title={r.is_featured ? "Unfeature" : "Feature this listing"}
                          className={`text-xs font-semibold border rounded-lg px-2 py-1.5 transition-colors disabled:opacity-40 ${r.is_featured ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                        >
                          {r.is_featured ? "★ Featured" : "☆ Feature"}
                        </button>
                        <button
                          onClick={() => togglePause(r.id, r.is_active === false)}
                          disabled={rowBusy === r.id}
                          title={r.is_active === false ? "Show on site" : "Hide from site"}
                          className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 ${r.is_active === false ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                        >
                          {r.is_active === false ? "▶ Activate" : "⏸ Pause"}
                        </button>
                        <button
                          onClick={() => deleteListing(r)}
                          disabled={rowBusy === r.id}
                          title="Delete listing"
                          className="text-xs font-semibold border border-red-200 bg-red-50 text-red-600 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition-colors disabled:opacity-40"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No listings found</p>}
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-end gap-3 mt-4">
          {pendingCount > 0 && (
            <span className="text-xs text-blue-600 font-medium">{pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}</span>
          )}
          {savedAt && pendingCount === 0 && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
          <button
            onClick={saveChanges}
            disabled={pendingCount === 0 || savingAll}
            className="text-sm font-semibold bg-green-600 text-white rounded-xl px-5 py-2.5 hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingAll ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

