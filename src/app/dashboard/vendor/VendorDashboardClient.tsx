"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import { formatLocalBucks, formatPrice } from "@/lib/utils";
import PremiumGate from "@/components/vendor/PremiumGate";

type Tab = "overview" | "listings" | "analytics" | "bookings" | "crm" | "referrals" | "store";

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
  };
  profile: { local_bucks: number; full_name: string | null; referral_code: string; email: string; avatar_url: string | null; phone: string | null } | null;
  isPremium: boolean;
  connectEnabled: boolean;
  connectAccountId: string | null;
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
  created_at: string;
};

type Booking = {
  id: string;
  status: string;
  scheduled_at: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
  buyer: { full_name: string | null; email: string } | null;
  listing: { title: string } | null;
};

type Customer = {
  id: string;
  full_name: string | null;
  email: string;
  booking_count: number;
  total_spent: number;
  last_booking_at: string | null;
};

const NAV: { id: Tab; label: string; icon: string; premiumOnly?: boolean }[] = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "store", label: "Store Settings", icon: "🏪" },
  { id: "listings", label: "Listings", icon: "📦" },
  { id: "analytics", label: "Analytics", icon: "📊", premiumOnly: true },
  { id: "bookings", label: "Bookings", icon: "📅", premiumOnly: true },
  { id: "crm", label: "Customers", icon: "👥", premiumOnly: true },
  { id: "referrals", label: "Referrals", icon: "🤝" },
];

export default function VendorDashboardClient({ vendor, profile, isPremium, connectEnabled, connectAccountId }: Props) {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState({ totalViews: 0, totalClicks: 0, totalListings: 0, activeListings: 0, pendingBookings: 0, thisWeekViews: 0 });
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localProfile, setLocalProfile] = useState({ full_name: profile?.full_name ?? null, avatar_url: profile?.avatar_url ?? null, phone: profile?.phone ?? null });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
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

  useEffect(() => {
    loadListings();
    loadBookings();
    if (isPremium) loadCustomers();
  }, [loadListings, loadBookings, loadCustomers, isPremium]);

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
    const res = await fetch("/api/stripe/connect", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setConnectingStripe(false);
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

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100">
          <Link href="/" className="text-lg font-bold text-green-600">HyperLocal</Link>
        </div>

        {/* Vendor info */}
        <div className="p-4 border-b border-gray-100">
          {/* Business row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center font-bold text-green-700 overflow-hidden shrink-0">
              {vendor.logo_url
                ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
                : vendor.business_name[0]}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{vendor.business_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPremium ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                {isPremium ? "⭐ Premium" : "Free"}
              </span>
            </div>
          </div>

          {/* Personal account dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs shrink-0 overflow-hidden">
                {localProfile.avatar_url
                  ? <img src={localProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (localProfile.full_name ?? profile?.email ?? "?")[0].toUpperCase()}
              </div>
              <p className="text-xs text-gray-600 truncate flex-1">{localProfile.full_name ?? profile?.email}</p>
              <span className="text-gray-400 text-xs">{showDropdown ? "▲" : "▼"}</span>
            </button>

            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => { setShowSettings(true); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>⚙️</span> Account Settings
                </button>
                <button
                  onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-50"
                >
                  <span>🚪</span> Sign out
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-base">🪙</span>
            <div>
              <p className="text-xs font-bold text-amber-700">{formatLocalBucks(profile?.local_bucks ?? 0)}</p>
              <p className="text-xs text-amber-600">Local Bucks balance</p>
            </div>
          </div>

          <button
            onClick={() => setTab("store")}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            🏪 Manage My Store
          </button>
          {vendor.city && (
            <Link
              href={`/community/${vendor.city.toLowerCase().replace(/\s+/g, "-")}-${(vendor.state || "mn").toLowerCase()}`}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-white border border-green-300 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              🏘️ Ask Your Neighbors
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${
                tab === item.id
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.premiumOnly && !isPremium && (
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
          <Link
            href={`/vendors/${vendor.slug}`}
            target="_blank"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span>🔗</span> View public profile
          </Link>
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
              ⭐ Upgrade to Premium
            </Link>
          )}

          {/* Stripe Connect — only shown to premium vendors */}
          {isPremium && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {connectEnabled ? (
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
              {!connectEnabled && connectAccountId && (
                <p className="text-xs text-center text-yellow-600 mt-1.5">Setup incomplete — click to finish</p>
              )}
              {connectEnabled && (
                <p className="text-xs text-center text-green-600 mt-1.5">✓ Payments enabled</p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Upgrade success toast */}
          {showUpgradedToast && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="font-semibold text-green-800">Welcome to Premium!</p>
                  <p className="text-sm text-green-600">Analytics, bookings, and CRM are now unlocked.</p>
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
                <button
                  onClick={() => { setTab("listings"); setShowNewListing(true); }}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  + Add Listing
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: "👁️", color: "blue" },
                  { label: "Total Clicks", value: stats.totalClicks.toLocaleString(), icon: "🖱️", color: "purple" },
                  { label: "Active Listings", value: `${stats.activeListings}/${stats.totalListings}`, icon: "📦", color: "green" },
                  { label: "Pending Bookings", value: stats.pendingBookings.toString(), icon: "📅", color: "amber" },
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

              {/* Stripe Connect banner */}
              {isPremium && !connectEnabled && (
                <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div>
                      <p className="font-semibold text-indigo-900">Accept payments from customers</p>
                      <p className="text-sm text-indigo-600">Connect your Stripe account to get paid directly — no middleman.</p>
                    </div>
                  </div>
                  <button
                    onClick={connectStripe}
                    disabled={connectingStripe}
                    className="shrink-0 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {connectingStripe ? "Redirecting..." : "Connect Stripe →"}
                  </button>
                </div>
              )}
              {isPremium && connectEnabled && (
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-semibold text-indigo-900">Payments enabled</p>
                      <p className="text-sm text-indigo-500">Customers can pay you directly through HyperLocal.</p>
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
                  <p className="text-sm font-medium text-gray-500 mb-1">Local Bucks Earned</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-600">{vendor.local_bucks_earned.toLocaleString()}</span>
                    <span className="text-amber-400 text-sm">🪙</span>
                  </div>
                </div>
              </div>

              {/* Recent listings */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Listings</h2>
                  <button onClick={() => setTab("listings")} className="text-sm text-green-600 hover:underline">
                    View all →
                  </button>
                </div>
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm mb-4">No listings yet.</p>
                    <button
                      onClick={() => { setTab("listings"); setShowNewListing(true); }}
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
                        Get analytics, CRM tools, booking management, and smart buttons for $49/month.
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
            isPremium ? (
              <AnalyticsTab listings={listings} stats={stats} />
            ) : <PremiumGate feature="Analytics Dashboard" />
          )}

          {/* ── BOOKINGS ── */}
          {tab === "bookings" && (
            isPremium ? (
              <BookingsTab
                bookings={bookings}
                loading={loadingBookings}
                onUpdateStatus={updateBookingStatus}
              />
            ) : <PremiumGate feature="Booking Management" />
          )}

          {/* ── CRM ── */}
          {tab === "crm" && (
            isPremium ? (
              <CRMTab customers={customers} />
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
            <StoreSettingsTab vendor={vendor} supabase={supabase} />
          )}
        </div>
      </main>
    </div>

    {showSettings && profile && (
      <AccountSettingsModal
        profile={{ id: vendor.user_id, full_name: localProfile.full_name, email: profile.email, avatar_url: localProfile.avatar_url, phone: localProfile.phone }}
        onClose={() => setShowSettings(false)}
        onSaved={(updated) => setLocalProfile(updated)}
      />
    )}
    </>
  );
}

// ── LISTINGS TAB ──────────────────────────────────────────────
function ListingsTab({
  listings, loading, vendorId, showNew, onShowNew,
  onToggle, onDelete, onRefresh, editingListing, onEdit,
}: {
  listings: Listing[]; loading: boolean; vendorId: string;
  showNew: boolean; onShowNew: (v: boolean) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void; onRefresh: () => void;
  editingListing: Listing | null; onEdit: (l: Listing | null) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: "", type: "product", price: "", price_label: "", description: "",
    category: "Products", quantity: "", condition: "new", tags: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Products"]);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setImages(editingListing.images ?? []);
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

  async function saveListing() {
    setSaving(true);
    const payload = {
      vendor_id: vendorId,
      title: form.title,
      type: form.type,
      price: form.price ? Number(form.price) : null,
      price_label: form.price_label || null,
      description: form.description || null,
      category: selectedCategories[0] ?? form.category,
      categories: selectedCategories,
      quantity: form.quantity ? Number(form.quantity) : null,
      condition: form.type === "product" ? form.condition : null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      images,
    };

    if (editingListing) {
      await supabase.from("listings").update(payload).eq("id", editingListing.id);
      onEdit(null);
    } else {
      await supabase.from("listings").insert(payload);
    }

    setForm({ title: "", type: "product", price: "", price_label: "", description: "", category: "Products", quantity: "", condition: "new", tags: "" });
    setSelectedCategories(["Products"]);
    setImages([]);
    onShowNew(false);
    onRefresh();
    setSaving(false);
  }

  const LISTING_TYPES = [
    { value: "product", label: "Product" },
    { value: "service", label: "Service" },
    { value: "restaurant", label: "Restaurant / Food" },
    { value: "event", label: "Event" },
    { value: "rental", label: "Rental" },
    { value: "thrift", label: "Thrift Sale" },
  ];
  const CATEGORIES = ["Products", "Services & Trades", "Restaurants & Food", "Events & Rentals", "Health & Beauty", "Home & Garden", "Clothing & Accessories", "Arts & Crafts", "Sports & Outdoors", "Auto & Transportation", "Pet Services", "Childcare & Education"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <button
          onClick={() => { onEdit(null); onShowNew(true); }}
          className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + New Listing
        </button>
      </div>

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
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {LISTING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
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
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{l.title}</p>
                    <p className="text-xs text-gray-400">{l.category}</p>
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
                      <button onClick={() => onDelete(l.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
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

// ── ANALYTICS TAB ─────────────────────────────────────────────
function AnalyticsTab({ listings, stats }: { listings: Listing[]; stats: { totalViews: number; totalClicks: number } }) {
  const conversionRate = stats.totalViews > 0
    ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1)
    : "0.0";

  const topListings = [...listings].sort((a, b) => b.view_count - a.view_count).slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Profile Views", value: stats.totalViews.toLocaleString(), icon: "👁️", sub: "All time" },
          { label: "Total Clicks", value: stats.totalClicks.toLocaleString(), icon: "🖱️", sub: "Across all listings" },
          { label: "Click-Through Rate", value: `${conversionRate}%`, icon: "📈", sub: "Clicks ÷ Views" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
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
              const maxViews = topListings[0]?.view_count || 1;
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
                    <div
                      className="h-full bg-green-400 rounded-full"
                      style={{ width: `${(l.view_count / maxViews) * 100}%` }}
                    />
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
function BookingsTab({ bookings, loading, onUpdateStatus }: {
  bookings: Booking[]; loading: boolean; onUpdateStatus: (id: string, status: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <div className="flex gap-2">
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
                      {b.buyer?.full_name ?? b.buyer?.email ?? "Unknown buyer"}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[b.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {b.status}
                    </span>
                  </div>
                  {b.listing && <p className="text-xs text-gray-500 mb-0.5">📦 {b.listing.title}</p>}
                  {b.scheduled_at && (
                    <p className="text-xs text-gray-500">
                      📅 {new Date(b.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                  {b.notes && <p className="text-xs text-gray-400 mt-1 italic">"{b.notes}"</p>}
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
          Share your unique links — earn <span className="font-semibold text-amber-600">50 Local Bucks</span> for every person who signs up and makes a purchase.
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
            <li>They complete their first purchase or booking</li>
            <li>You earn <strong>50 Local Bucks</strong> — automatically, instantly</li>
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
                      {r.bucks_awarded ? "🪙 +50 LB earned" : r.converted ? "Converted" : "Pending"}
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
];

function StoreSettingsTab({ vendor, supabase }: { vendor: any; supabase: any }) {
  const [businessName, setBusinessName] = useState(vendor.business_name ?? "");
  const [description, setDescription] = useState(vendor.description ?? "");
  const [category, setCategory] = useState(vendor.category ?? "");
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [website, setWebsite] = useState(vendor.website ?? "");
  const [address, setAddress] = useState(vendor.address ?? "");
  const [city, setCity] = useState(vendor.city ?? "");
  const [vendorState, setVendorState] = useState(vendor.state ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(vendor.logo_url);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(vendor.banner_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      const ext = logoFile.name.split(".").pop();
      const { error: err } = await supabase.storage.from("vendor-logos").upload(`${vendor.id}/logo.${ext}`, logoFile, { upsert: true });
      if (err) { setError("Logo upload failed: " + err.message); setSaving(false); return; }
      logoUrl = supabase.storage.from("vendor-logos").getPublicUrl(`${vendor.id}/logo.${ext}`).data.publicUrl;
    }
    if (bannerFile) {
      const ext = bannerFile.name.split(".").pop();
      const { error: err } = await supabase.storage.from("vendor-banners").upload(`${vendor.id}/banner.${ext}`, bannerFile, { upsert: true });
      if (err) { setError("Banner upload failed: " + err.message); setSaving(false); return; }
      bannerUrl = supabase.storage.from("vendor-banners").getPublicUrl(`${vendor.id}/banner.${ext}`).data.publicUrl;
    }
    const { error: updateErr } = await supabase.from("vendors").update({
      business_name: businessName.trim(),
      description: description.trim() || null,
      category,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      city: city.trim(),
      state: vendorState.trim(),
      logo_url: logoUrl,
      banner_url: bannerUrl,
    }).eq("id", vendor.id);
    if (updateErr) { setError(updateErr.message); } else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Store Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Edit your public storefront — changes are live immediately.</p>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Banner photo</label>
          <div onClick={() => bannerRef.current?.click()} className="w-full h-32 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 hover:border-green-400 cursor-pointer transition-colors flex items-center justify-center">
            {bannerPreview ? <img src={bannerPreview} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-sm">Click to upload banner (1200x300 recommended)</span>}
          </div>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={onBannerChange} />
        </div>
        <div className="flex items-center gap-4">
          <div onClick={() => logoRef.current?.click()} className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center font-bold text-2xl text-green-700 overflow-hidden cursor-pointer ring-2 ring-green-100 hover:ring-green-400 transition-all shrink-0">
            {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-cover" /> : businessName[0]}
          </div>
          <div>
            <button type="button" onClick={() => logoRef.current?.click()} className="text-sm text-green-600 font-medium hover:underline">Change logo</button>
            <p className="text-xs text-gray-400 mt-0.5">Square image, at least 200x200px</p>
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
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}
        <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${saved ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"}`}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save store settings"}
        </button>
      </form>
      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs text-gray-500">Your public storefront: <a href={`/vendors/${vendor.slug}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline font-medium">/vendors/{vendor.slug}</a></p>
      </div>
    </div>
  );
}
