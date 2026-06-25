"use client";

import { useState } from "react";
import Link from "next/link";

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
  bucksHistory: BucksTransaction[];
  referrals: Referral[];
  referredBy: ReferredBy;
  recentListings: RecentListing[];
  newVendors: NewVendor[];
  savedCity: string | null;
  savedState: string | null;
  vendorAccount: VendorAccount;
}

const REASON_LABELS: Record<string, string> = {
  signup_bonus: "Signed up",
  vendor_signup: "Created your storefront",
  first_purchase: "First purchase",
  leave_review: "Left a review",
  referral_conversion: "Referral converted",
  phone_verified: "Verified phone number",
  boost_vendor: "Boosted a vendor",
  featured_profile: "Featured profile",
  premium_listing: "Premium listing",
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

export default function BuyerDashboardClient({ profile, bookings, bucksHistory, referrals, referredBy, recentListings, newVendors, savedCity, savedState, vendorAccount }: Props) {
  const [tab, setTab] = useState<"overview" | "bookings" | "bucks" | "referrals">("overview");
  const [copied, setCopied] = useState<"profile" | "signup" | null>(null);

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
    { id: "bookings", label: "Bookings", icon: "📅" },
    { id: "bucks", label: "Local Bucks", icon: "🪙" },
    { id: "referrals", label: "Referrals", icon: "🤝" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <Link href="/" className="text-lg font-bold text-green-600">HyperLocal</Link>
          <p className="text-xs text-gray-400 mt-0.5">Buyer Dashboard</p>
        </div>

        {/* Profile summary */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile.full_name ?? profile.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name ?? "Buyer"}</p>
              <p className="text-xs text-amber-600 font-medium">🪙 {profile.local_bucks.toLocaleString()} LB</p>
            </div>
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
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                tab === item.id
                  ? "bg-green-50 text-green-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
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
              <p className="text-xs text-green-600 mb-2">List it free on HyperLocal</p>
              <Link
                href="/onboarding/vendor"
                className="block text-center text-xs font-semibold bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Storefront →
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">

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
                { label: "Local Bucks", value: `🪙 ${profile.local_bucks.toLocaleString()}`, sub: "available to spend", color: "text-amber-600" },
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
                  onClick={() => setTab("bucks")}
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
                  <p className="font-bold text-lg">+50</p>
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
                  <button onClick={() => setTab("bookings")} className="text-xs text-green-600 hover:underline">
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {bookings.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {b.vendor?.logo_url
                          ? <img src={b.vendor.logo_url} alt="" className="w-full h-full object-cover" />
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
                                {l.type === "product" ? "📦" : l.type === "restaurant" ? "🍽️" : "🔧"}
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
                      <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden">
                        {v.logo_url
                          ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
                          : v.business_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{v.business_name}</p>
                        <p className="text-xs text-gray-400">{v.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {v.rating > 0 && (
                          <p className="text-xs font-medium text-gray-700">★ {v.rating.toFixed(1)}</p>
                        )}
                        {v.tier === "premium" && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">⭐ Premium</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No neighborhood set yet */}
            {!savedCity && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6 text-center">
                <p className="text-2xl mb-2">🏘️</p>
                <p className="font-semibold text-gray-900 mb-1">Set your neighborhood</p>
                <p className="text-sm text-gray-500 mb-4">We'll show you recent listings and new businesses near you every time you log in.</p>
                <Link href="/onboarding/buyer" className="inline-block bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
                  Set my location →
                </Link>
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

        {/* ── BOOKINGS ── */}
        {tab === "bookings" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>

            {bookings.length === 0 ? (
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
                                ? <img src={b.vendor.logo_url} alt="" className="w-full h-full object-cover" />
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
          </div>
        )}

        {/* ── LOCAL BUCKS ── */}
        {tab === "bucks" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Local Bucks</h1>
            <p className="text-gray-500 text-sm mb-6">Earn by engaging with the community. Spend to boost your profile or favorite vendors.</p>

            {/* Balance */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white mb-6">
              <p className="text-amber-100 text-sm">Current Balance</p>
              <p className="text-5xl font-bold mt-1">🪙 {profile.local_bucks.toLocaleString()}</p>
            </div>

            {/* How to earn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Ways to Earn</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Sign up", amount: "+10" },
                    { label: "Verify phone", amount: "+5" },
                    { label: "Leave a review", amount: "+5" },
                    { label: "Refer a friend", amount: "+50" },
                    { label: "First purchase", amount: "+25" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className="text-sm font-bold text-amber-600">{item.amount} 🪙</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Ways to Spend</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Boost a vendor (1 day)", amount: "50" },
                    { label: "Featured profile (1 week)", amount: "150" },
                    { label: "Premium listing", amount: "100" },
                    { label: "Unlock exclusive deals", amount: "200" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className="text-sm font-bold text-gray-500">{item.amount} 🪙</span>
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
              Share your link — earn <span className="font-semibold text-amber-600">50 Local Bucks</span> when someone signs up and makes their first purchase.
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
                  <li>They make their first purchase or booking</li>
                  <li>You instantly earn <strong>50 Local Bucks</strong></li>
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
                            {r.bucks_awarded ? "🪙 +50 LB" : r.converted ? "Converted" : "Pending"}
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
      </main>
    </div>
  );
}
