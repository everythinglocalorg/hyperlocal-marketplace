"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import BusinessPicksManager, { type PickVendor } from "@/components/BusinessPicksManager";
import ProfileDetailsEditor, { normalizeDetails } from "@/components/ProfileDetailsEditor";
import VendorLogo from "@/components/vendor/VendorLogo";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  local_bucks: number;
  referral_code: string;
  phone: string | null;
  city: string | null;
  state: string | null;
};

type Booking = {
  id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  vendor: {
    business_name: string;
    slug: string;
    logo_url: string | null;
    city: string;
    state: string;
  } | null;
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
  signed_waiver_pdf_url: string | null;
  payment_status: string | null;
  created_at: string;
  vendor: { business_name: string; slug: string } | null;
  listing: { title: string } | null;
};

type BucksTransaction = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

type Referral = {
  id: string;
  converted: boolean;
  bucks_awarded: boolean;
  created_at: string;
  referred: { full_name: string | null; email: string } | null;
};

type ReferredBy = {
  full_name: string | null;
  email: string;
  referral_code: string;
} | null;

type RecentListing = {
  id: string;
  title: string;
  price: number | null;
  price_label: string | null;
  images: string[];
  type: string;
  vendor: { business_name: string; slug: string; logo_url: string | null; city: string; state: string } | null;
};

type NewVendor = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  category: string;
  city: string;
  state: string;
  rating: number;
  review_count: number;
  tier: string;
  is_verified: boolean;
};

type VendorAccount = { id: string; business_name: string; slug: string } | null;

interface Props {
  profile: Profile;
  bookings: Booking[];
  rentalBookings: RentalBooking[];
  bucksHistory: BucksTransaction[];
  referrals: Referral[];
  referredBy: ReferredBy;
  recentListings: RecentListing[];
  newVendors: NewVendor[];
  savedCity: string | null;
  savedState: string | null;
  vendorAccount: VendorAccount;
  engagedVendors: PickVendor[];
  businessPicks: PickVendor[];
  profileDetails: any;
  ownedBusinessCount: number;
}

const REASON_LABELS: Record<string, string> = {
  signup_bonus: "Signed up",
  add_phone: "Added your phone number",
  leave_review: "Left a review",
  complete_vendor_profile: "Completed your storefront",
  referral_conversion: "Referral converted",
  referral_signup: "Referral signed up",
  connect_stripe: "Connected Stripe payouts",
  connect_domain: "Connected a custom domain",
  refer_business: "Recommended a business to a neighbor",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-100",
  confirmed: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-green-50 text-green-700 border-green-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
};

const STATUS_ICONS: Record<string, string> = {
  pending: "⏳",
  confirmed: "✅",
  completed: "🎉",
  cancelled: "✕",
};

export default function BuyerDashboardClient({ profile, bookings, rentalBookings, bucksHistory, referrals, referredBy, recentListings, newVendors, savedCity, savedState, vendorAccount, engagedVendors, businessPicks, profileDetails, ownedBusinessCount }: Props) {
  const [tab, setTab] = useState<"overview" | "bookings" | "bucks" | "referrals" | "messages" | "profile">(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && ["overview", "bookings", "bucks", "referrals", "messages", "profile"].includes(t)) {
        return t as "overview" | "bookings" | "bucks" | "referrals" | "messages" | "profile";
      }
    }
    return "overview";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabStack, setTabStack] = useState<typeof tab[]>([]);
  const goToTab = (t: typeof tab) => {
    setTabStack((s) => (t === tab ? s : [...s, tab]));
    setTab(t);
    setSidebarOpen(false);
  };
  const goBack = () => setTabStack((s) => {
    if (!s.length) return s;
    setTab(s[s.length - 1]);
    return s.slice(0, -1);
  });
  const [copied, setCopied] = useState<"profile" | "signup" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localProfile, setLocalProfile] = useState({ full_name: profile.full_name, avatar_url: profile.avatar_url, phone: profile.phone });
  const supabase = createClient();
  const [conversations, setBuyerConversations] = useState<any[]>([]);
  const [activeConvId, setActiveBuyerConvId] = useState<string | null>(null);
  const [convMessages, setBuyerConvMessages] = useState<any[]>([]);
  const [msgBody, setBuyerMsgBody] = useState("");
  const [unreadMsgCount, setBuyerUnreadCount] = useState(0);

  useEffect(() => {
    supabase
      .from("conversations")
      .select("*, vendor:vendors(id, business_name, user_id)")
      .eq("buyer_id", profile.id)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setBuyerConversations(data);
          setBuyerUnreadCount(data.reduce((n: number, c: any) => n + (c.buyer_unread ?? 0), 0));
        }
      });
  }, [profile.id]);

  async function openBuyerConversation(convId: string) {
    setActiveBuyerConvId(convId);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    setBuyerConvMessages(data ?? []);
    await supabase.from("conversations").update({ buyer_unread: 0 }).eq("id", convId);
    setBuyerConversations((prev) => prev.map((c) => c.id === convId ? { ...c, buyer_unread: 0 } : c));
    setBuyerUnreadCount((n) => Math.max(0, n - (conversations.find((c) => c.id === convId)?.buyer_unread ?? 0)));
  }

  async function sendBuyerMessage() {
    if (!msgBody.trim() || !activeConvId) return;
    const text = msgBody.trim();
    setBuyerMsgBody("");
    const conv = conversations.find((c) => c.id === activeConvId);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: profile.id, body: text, created_at: new Date().toISOString() };
    setBuyerConvMessages((prev) => [...prev, optimistic]);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: activeConvId, body: text }),
    });
    const { message: inserted } = await res.json();
    if (inserted) setBuyerConvMessages((prev) => prev.map((m) => m.id === optimistic.id ? inserted : m));
    await supabase.from("conversations").update({
      vendor_unread: (conv?.vendor_unread ?? 0) + 1,
    }).eq("id", activeConvId);
  }
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const signupLink = `${appUrl}/signup?ref=${profile.referral_code}`;

  function copyLink(type: "profile" | "signup") {
    navigator.clipboard.writeText(signupLink);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;
  const completedBookings = bookings.filter((b) => b.status === "completed").length;
  const totalReferralBucks = referrals.filter((r) => r.bucks_awarded).length * 50;

  const NAV = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "profile", label: "Local Profile", icon: "⭐" },
    { id: "messages", label: "Messages", icon: "💬" },
    { id: "bookings", label: "Bookings", icon: "📅" },
    { id: "bucks", label: "Local Bucks", icon: "🪙" },
    { id: "referrals", label: "Referrals", icon: "🤝" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      {/* Sidebar — off-canvas drawer on mobile, fixed sidebar on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-100 flex flex-col overflow-y-auto transform transition-transform duration-200 lg:translate-x-0 lg:static lg:shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-gray-100">
          <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
        </div>

        {/* Profile summary */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-3 rounded-xl hover:bg-gray-50 p-1 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden">
                {localProfile.avatar_url
                  ? <img src={localProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (localProfile.full_name ?? profile.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{localProfile.full_name ?? "Account"}</p>
                <p className="text-xs text-amber-600 font-medium">🪙 {profile.local_bucks.toLocaleString()} LB</p>
              </div>
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
                  onClick={async () => {
                    const { createClient: cc } = await import("@/lib/supabase/client");
                    await cc().auth.signOut();
                    window.location.href = "/";
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-50"
                >
                  <span>🚪</span> Sign out
                </button>
              </div>
            )}
          </div>

          {/* Storefront quick-access — shown right under profile if they have one */}
          {vendorAccount && (
            <Link
              href="/dashboard/vendor"
              className="mt-3 flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-xl hover:bg-green-700 transition-colors"
            >
              <span className="text-base">🏪</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{vendorAccount.business_name}</p>
                <p className="text-xs text-green-200">Manage Storefront →</p>
              </div>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => goToTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                tab === item.id
                  ? "bg-green-50 text-green-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.id === "messages" && unreadMsgCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadMsgCount}</span>
              )}
              {item.id === "bookings" && pendingBookings > 0 && (
                <span className="ml-auto bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {pendingBookings}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom CTA — only show if no vendor account */}
        {!vendorAccount && (
          <div className="p-4 border-t border-gray-100">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">Have a business?</p>
              <p className="text-xs text-green-600 mb-2">List it free on Everything Local</p>
              <Link
                href="/onboarding/vendor"
                className="block text-center text-xs font-semibold bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Storefront →
              </Link>
            </div>
          </div>
        )}

        {/* Local Loop + Local Jobs */}
        {savedCity && (
          <div className="p-3 border-t border-gray-800 space-y-2">
            <Link
              href={`/community/${savedCity.toLowerCase().replace(/\s+/g, "-")}-${(savedState || "mn").toLowerCase()}`}
              className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              🏘️ Local Loop
            </Link>
            <Link
              href={`/jobs/${savedCity.toLowerCase().replace(/\s+/g, "-")}-${(savedState || "mn").toLowerCase()}`}
              className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              💼 Local Jobs
            </Link>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-2 -ml-2 text-gray-700 hover:text-green-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-green-600">Everything Local</span>
        </div>
        <div className="p-4 sm:p-8">

        {/* Internal back button — appears once you've navigated between tabs */}
        {tabStack.length > 0 && (
          <button onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        )}

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              {profile.city && profile.state ? `Browsing near ${profile.city}, ${profile.state}` : "Discover local businesses near you"}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Local Bucks", value: `🪙 ${profile.local_bucks.toLocaleString()}`, sub: "in your wallet", color: "text-amber-600" },
                { label: "Bookings", value: bookings.length, sub: `${pendingBookings} pending`, color: "text-blue-600" },
                { label: "Completed", value: completedBookings, sub: "services received", color: "text-green-600" },
                { label: "Referrals", value: referrals.length, sub: `${referrals.filter((r) => r.converted).length} converted`, color: "text-purple-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Local Bucks balance card */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Your Balance</p>
                  <p className="text-4xl font-bold mt-1">🪙 {profile.local_bucks.toLocaleString()}</p>
                  <p className="text-amber-100 text-sm mt-1">Local Bucks</p>
                </div>
                <button
                  onClick={() => goToTab("bucks")}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-colors"
                >
                  View history →
                </button>
              </div>
              <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="font-bold text-lg">+10</p>
                  <p className="text-amber-100">Signup</p>
                </div>
                <div>
                  <p className="font-bold text-lg">+20</p>
                  <p className="text-amber-100">Per referral</p>
                </div>
                <div>
                  <p className="font-bold text-lg">+5</p>
                  <p className="text-amber-100">Per review</p>
                </div>
              </div>
            </div>

            {/* Recent bookings */}
            {bookings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
                  <button onClick={() => goToTab("bookings")} className="text-xs text-green-600 hover:underline">
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {bookings.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {b.vendor?.logo_url
                          ? <img src={b.vendor.logo_url} alt="" className="w-full h-full object-contain" />
                          : <span className="text-lg">{STATUS_ICONS[b.status]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.vendor?.business_name ?? "Unknown vendor"}</p>
                        <p className="text-xs text-gray-400">
                          {b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date set"}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[b.status]}`}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent listings in their neighborhood */}
            {savedCity && recentListings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">Recent listings near {savedCity}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">New items just added in your neighborhood</p>
                  </div>
                  <Link href={`/search?city=${encodeURIComponent(savedCity + (savedState ? ", " + savedState : ""))}`}
                    className="text-xs text-green-600 hover:underline">View all →</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  {recentListings.map((l) => {
                    const vendor = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
                    return (
                      <Link key={l.id} href={`/vendors/${vendor?.slug ?? ""}`}
                        className="bg-white p-4 hover:bg-green-50 transition-colors">
                        <div className="w-full h-28 rounded-xl bg-gray-100 overflow-hidden mb-3">
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
                                {({ product:"📦", service:"🔧", restaurant:"🍽️", event:"🎉", rental:"🏠", thrift:"🏷️" } as Record<string,string>)[l.type] ?? "📦"}
                              </div>}
                        </div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{l.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{vendor?.business_name}</p>
                        {l.price !== null && (
                          <p className="text-sm font-bold text-green-700 mt-1">${l.price.toFixed(2)}</p>
                        )}
                        {l.price === null && l.price_label && (
                          <p className="text-xs text-gray-500 mt-1">{l.price_label}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* New vendors in their neighborhood */}
            {savedCity && newVendors.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">New businesses in {savedCity}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Recently joined your community</p>
                  </div>
                  <Link href={`/search?city=${encodeURIComponent(savedCity + (savedState ? ", " + savedState : ""))}`}
                    className="text-xs text-green-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {newVendors.map((v) => (
                    <Link key={v.id} href={`/vendors/${v.slug}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-green-50 transition-colors">
                      <VendorLogo src={v.logo_url} name={v.business_name} className="w-11 h-11" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{v.business_name}</p>
                        <p className="text-xs text-gray-400">{v.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {v.rating > 0 && (
                          <p className="text-xs font-medium text-gray-700">★ {v.rating.toFixed(1)}</p>
                        )}
                        {v.tier === "premium" && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">⭐ Local Pro</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}


            {/* Discover CTA */}
            <div className="bg-green-600 rounded-2xl p-6 text-white flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-lg">Find local businesses near you</p>
                <p className="text-green-100 text-sm mt-1">Plumbers, restaurants, fresh produce, and more.</p>
              </div>
              <Link
                href={savedCity ? `/search?city=${encodeURIComponent(savedCity + (savedState ? ", " + savedState : ""))}` : "/search"}
                className="shrink-0 bg-white text-green-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-green-50 transition-colors text-sm"
              >
                Search now →
              </Link>
            </div>
          </div>
        )}

        {/* ── PUBLIC PROFILE ── */}
        {tab === "profile" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">⭐ Your Local Profile</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your public stamp of approval — the local businesses you stand behind. Share your profile to put your neighbors onto your favorites and help great local spots get recognized.
            </p>

            {/* Profile photo + identity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700 overflow-hidden shrink-0">
                {localProfile.avatar_url
                  ? <img src={localProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (localProfile.full_name ?? profile.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{localProfile.full_name ?? "Your name"}</p>
                <p className="text-xs text-gray-400">This photo shows at the top of your Local Profile.</p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="shrink-0 text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:border-green-400 hover:text-green-700 transition-colors"
              >
                📷 Change photo
              </button>
            </div>

            {/* Share / view bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-1">Your profile link</p>
                <p className="text-xs text-gray-500 truncate font-mono">{appUrl}/u/{profile.id}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${appUrl}/u/${profile.id}`);
                    setCopied("profile");
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    copied === "profile" ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"
                  }`}
                >
                  {copied === "profile" ? "Copied! ✓" : "Copy link"}
                </button>
                <Link
                  href={`/u/${profile.id}`}
                  target="_blank"
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>

            <BusinessPicksManager
              userId={profile.id}
              engagedVendors={engagedVendors}
              initialPicks={businessPicks}
            />

            <ProfileDetailsEditor
              userId={profile.id}
              initial={normalizeDetails(profileDetails)}
              ownedBusinessCount={ownedBusinessCount}
            />
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === "messages" && (
          <div className="flex gap-4 h-[70vh] lg:h-[600px]">
            {/* Conversation list — full width on mobile, hidden once a chat is open */}
            <div className={`w-full lg:w-64 lg:shrink-0 border border-gray-100 rounded-2xl overflow-y-auto bg-white ${activeConvId ? "hidden lg:block" : "block"}`}>
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">💬 My Messages</h2>
              </div>
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No messages yet.<br/>Click "Message" on any listing to start.</div>
              ) : (
                conversations.map((c) => {
                  const v = Array.isArray(c.vendor) ? c.vendor[0] : c.vendor;
                  return (
                    <button key={c.id} onClick={() => openBuyerConversation(c.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-green-50 transition-colors ${activeConvId === c.id ? "bg-green-50" : ""}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 truncate">{v?.business_name ?? "Vendor"}</p>
                        {c.buyer_unread > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{c.buyer_unread}</span>
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
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation</div>
              ) : (
                <>
                  {/* Mobile back to list */}
                  <div className="lg:hidden px-4 py-2.5 border-b border-gray-100">
                    <button onClick={() => setActiveBuyerConvId(null)} className="text-sm font-medium text-gray-500 hover:text-green-700">← All messages</button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {convMessages.map((m) => {
                      const isMe = m.sender_id === profile.id;
                      return (
                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-green-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
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
                    <input type="text" value={msgBody} onChange={(e) => setBuyerMsgBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendBuyerMessage(); }}
                      placeholder="Type a reply..."
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <button onClick={sendBuyerMessage} disabled={!msgBody.trim()}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">Send</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {tab === "bookings" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>

            {bookings.length === 0 && rentalBookings.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-gray-500 text-sm mb-4">No bookings yet.</p>
                <Link
                  href="/search"
                  className="inline-block bg-green-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
                >
                  Find a vendor →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(["pending", "confirmed", "completed", "cancelled"] as const).map((status) => {
                  const group = bookings.filter((b) => b.status === status);
                  if (group.length === 0) return null;
                  return (
                    <div key={status} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <span>{STATUS_ICONS[status]}</span>
                        <span className="text-sm font-semibold text-gray-700 capitalize">{status}</span>
                        <span className="text-xs text-gray-400">({group.length})</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {group.map((b) => (
                          <div key={b.id} className="flex items-start gap-4 px-6 py-5">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {b.vendor?.logo_url
                                ? <img src={b.vendor.logo_url} alt="" className="w-full h-full object-contain" />
                                : <span className="text-2xl">{STATUS_ICONS[b.status]}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{b.vendor?.business_name ?? "Unknown vendor"}</p>
                                  {b.vendor?.city && (
                                    <p className="text-xs text-gray-400 mt-0.5">{b.vendor.city}, {b.vendor.state}</p>
                                  )}
                                </div>
                                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[b.status]}`}>
                                  {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                </span>
                              </div>
                              {b.scheduled_at && (
                                <p className="text-sm text-gray-600 mt-2">
                                  📅 {new Date(b.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                                </p>
                              )}
                              {b.notes && (
                                <p className="text-sm text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-3 py-2">{b.notes}</p>
                              )}
                              <div className="flex items-center gap-3 mt-3">
                                {b.vendor?.slug && (
                                  <Link
                                    href={`/vendors/${b.vendor.slug}`}
                                    className="text-xs text-green-600 hover:underline font-medium"
                                  >
                                    View storefront →
                                  </Link>
                                )}
                                <p className="text-xs text-gray-400">
                                  Booked {new Date(b.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Rental bookings ── */}
            {rentalBookings.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🏕️ My Rentals</h2>
                <div className="space-y-3">
                  {rentalBookings.map((r) => {
                    const start = new Date(r.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const range = r.end_date && r.end_date !== r.start_date
                      ? `${start} – ${new Date(r.end_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : start;
                    return (
                      <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900">{r.listing?.title ?? "Rental"}</p>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{r.vendor?.business_name}</p>
                            <p className="text-sm text-gray-600 mt-1">📅 {range}{r.start_time && r.start_time !== "00:00" ? ` · ${r.start_time}` : ""}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{r.duration_label} ({r.duration_hours}h)</p>
                            {(r.payment_status === "deposit_paid" || r.payment_status === "paid") && (
                              <p className="text-xs text-green-600 font-medium mt-0.5">💳 {r.payment_status === "paid" ? "Paid in full" : "Deposit paid"}</p>
                            )}
                          </div>
                          <p className="font-bold text-gray-900 shrink-0">${Number(r.total_price).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                          {r.vendor?.slug && (
                            <Link href={`/vendors/${r.vendor.slug}`} className="text-xs text-green-600 hover:underline font-medium">View storefront →</Link>
                          )}
                          {r.signed_waiver_pdf_url && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/rental/waiver-url?booking=${r.id}`);
                                const json = await res.json();
                                if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
                                else alert(json.error ?? "Waiver not available.");
                              }}
                              className="text-xs text-gray-600 hover:text-green-700 font-medium"
                            >
                              📄 Download signed waiver
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOCAL BUCKS ── */}
        {tab === "bucks" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Local Bucks</h1>
            <p className="text-gray-500 text-sm mb-6">Earn by engaging with the community.</p>

            {/* Balance */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-6">
              <p className="text-amber-100 text-sm">Current Balance</p>
              <p className="text-5xl font-bold mt-1">🪙 {profile.local_bucks.toLocaleString()}</p>
            </div>

            {/* How to earn */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Ways to Earn</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Sign up", amount: "+10" },
                    { label: "Add your phone", amount: "+5" },
                    { label: "Leave a review", amount: "+5" },
                    { label: "Refer a friend", amount: "+20" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className="text-sm font-bold text-amber-600">{item.amount} 🪙</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Transaction History</h2>
              </div>
              {bucksHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🪙</p>
                  <p className="text-sm">No transactions yet. Start earning!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {bucksHistory.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 px-6 py-4">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                        tx.amount > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {tx.amount > 0 ? "+" : "−"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {REASON_LABELS[tx.reason] ?? tx.reason.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount} 🪙
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REFERRALS ── */}
        {tab === "referrals" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Referrals</h1>
            <p className="text-gray-500 text-sm mb-6">
              Share your link — earn <span className="font-semibold text-amber-600">20 Local Bucks</span> when someone signs up with it.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Referred", value: referrals.length, icon: "🤝" },
                { label: "Converted", value: referrals.filter((r) => r.converted).length, icon: "✅" },
                { label: "LB Earned", value: `${totalReferralBucks} 🪙`, icon: "💰" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                  <p className="text-2xl mb-1">{s.icon}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Referral link */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-1">Your Referral Link</h2>
              <p className="text-xs text-gray-400 mb-4">Anyone who signs up through this link is tagged as your referral.</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={signupLink}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 focus:outline-none font-mono"
                />
                <button
                  onClick={() => copyLink("signup")}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    copied === "signup" ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"
                  }`}
                >
                  {copied === "signup" ? "Copied! ✓" : "Copy"}
                </button>
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2">How it works:</p>
                <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Share your link with friends or local business owners</li>
                  <li>They sign up — automatically tagged as your referral</li>
                  <li>You instantly earn <strong>20 Local Bucks</strong></li>
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
              {referrals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🤝</p>
                  <p className="text-gray-500 text-sm mb-1">No referrals yet.</p>
                  <p className="text-gray-400 text-xs">Share your link above to start earning.</p>
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
                            {r.bucks_awarded ? "🪙 +20 LB" : r.converted ? "Converted" : "Pending"}
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
        )}
        </div>
      </main>

      {showSettings && (
        <AccountSettingsModal
          profile={{ ...profile, full_name: localProfile.full_name, avatar_url: localProfile.avatar_url, phone: localProfile.phone }}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => setLocalProfile(updated)}
        />
      )}
    </div>
  );
}
