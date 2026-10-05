"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import ShareQrModal, { QrGlyph, type ShareSlide } from "@/components/ShareQrModal";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";
import { BRAND_ORIGIN } from "@/lib/domains";
import { useFavorites } from "@/lib/favorites";
import { MessageCircle, Heart, Menu } from "lucide-react";

// Routes that render their own full-page chrome (own nav/sidebar) and should NOT
// show the global browse header.
const HIDDEN_PREFIXES = [
  "/admin", "/onboarding", "/login", "/signup",
  "/connect-domain", "/u/", "/profile", "/reset-password", "/auth",
  // Static/utility pages that already render their own full nav bar
  "/notifications", "/about", "/pricing", "/contact", "/terms", "/privacy",
  // Storefront pages render their own unified header with a site menu (hamburger)
  "/vendors/",
  // Product pages are an immersive full-page view with their own back button
  "/listings/",
];

export default function GlobalHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [headerQ, setHeaderQ] = useState("");
  // On the dashboard we still show this same bar (so it feels like one place) —
  // but only on desktop; mobile keeps the dashboard's own bar. Inside the
  // dashboard we drop the "Dashboard →" button since you're already there.
  const isDashboard = pathname.startsWith("/dashboard");
  const [user, setUser] = useState<{ id: string; name: string | null; role: string | null; referralCode?: string | null } | null>(null);
  const [myVendor, setMyVendor] = useState<{ slug: string; business_name: string } | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { wishlistCount } = useFavorites();

  // Close the mobile menu on outside click or when the route changes.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_CITY_KEY);
      if (saved) setActiveCity(saved);
    }
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (u) {
        const { data: profile } = await supabase
          .from("profiles").select("full_name, role, default_city, referral_code").eq("id", u.id).single();
        setUser({
          id: u.id,
          name: profile?.full_name ?? u.email ?? null,
          role: profile?.role ?? null,
          referralCode: profile?.referral_code ?? null,
        });
        if (profile?.default_city) setActiveCity(profile.default_city);
        supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("user_id", u.id).eq("is_read", false)
          .then(({ count }) => setNotifUnread(count ?? 0));
        // Their business (first one) → adds a storefront QR to the share sheet.
        supabase.from("vendors")
          .select("id, slug, business_name")
          .eq("user_id", u.id).eq("is_active", true)
          .order("created_at", { ascending: true })
          .then(async ({ data: myVendors }) => {
            setMyVendor(myVendors?.[0] ?? null);
            // Total unread across BOTH sides: buyer_unread on my customer threads
            // + vendor_unread on threads to any business I own.
            const vids = (myVendors ?? []).map((v) => v.id);
            const [asBuyer, asVendor] = await Promise.all([
              supabase.from("conversations").select("buyer_unread").eq("buyer_id", u.id),
              vids.length ? supabase.from("conversations").select("vendor_unread").in("vendor_id", vids) : Promise.resolve({ data: [] }),
            ]);
            const total =
              (asBuyer.data ?? []).reduce((n: number, c: { buyer_unread: number | null }) => n + (c.buyer_unread ?? 0), 0) +
              (asVendor.data ?? []).reduce((n: number, c: { vendor_unread: number | null }) => n + (c.vendor_unread ?? 0), 0);
            setMsgUnread(total);
          });
      }
      setAuthChecked(true);
    });
  }, [pathname]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  // Hide on routes with their own chrome
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  // The user's QR wallet: refer → profile → their storefront (if they have one).
  const shareSlides: ShareSlide[] = user
    ? [
        ...(user.referralCode
          ? [{
              key: "referral",
              label: "Refer",
              title: "Refer & earn",
              blurb: "Earn 20 Local Bucks when someone joins with your link — they get 10.",
              link: `${BRAND_ORIGIN}/signup?ref=${user.referralCode}`,
            }]
          : []),
        {
          key: "profile",
          label: "Profile",
          title: "My profile",
          blurb: "Your public Everything Local profile.",
          link: `${BRAND_ORIGIN}/u/${user.id}`,
        },
        ...(myVendor
          ? [{
              key: "business",
              label: "Business",
              title: myVendor.business_name,
              blurb: "Your storefront — download and print it for your counter.",
              link: `${BRAND_ORIGIN}/vendors/${myVendor.slug}${user.referralCode ? `?ref=${user.referralCode}` : ""}`,
              downloadName: `${myVendor.slug}-storefront-qr`,
            }]
          : []),
      ]
    : [];

  return (
    <>
      {/* Rendered outside <header> — a sticky parent creates a stacking context
          that would trap this fixed overlay. */}
      {shareOpen && shareSlides.length > 0 && (
        <ShareQrModal slides={shareSlides} onClose={() => setShareOpen(false)} />
      )}
    <header className={`border-b border-gray-100 bg-white sticky top-0 z-50 ${isDashboard ? "hidden lg:block" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {pathname === "/" ? (
          <>
            {/* Mobile home: a real search input (logo stays on desktop). Typing +
                Enter stays on the home page and shows results inline (?q=). */}
            <form
              data-tour="search"
              onSubmit={(e) => { e.preventDefault(); const q = headerQ.trim(); router.push(q ? `/?q=${encodeURIComponent(q)}` : "/"); }}
              className="md:hidden flex-1 flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full px-4 py-2 min-w-0 mr-1"
            >
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /></svg>
              <input
                value={headerQ}
                onChange={(e) => setHeaderQ(e.target.value)}
                placeholder="Search Everything Local"
                aria-label="Search Everything Local"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 placeholder:text-green-600 focus:outline-none"
              />
            </form>
            <Link href="/" className="hidden md:flex items-center min-w-0 shrink" aria-label="Everything Local home">
              <Logo size="sm" />
            </Link>
          </>
        ) : (
          <Link href="/" data-tour="home" className="flex items-center min-w-0 shrink" aria-label="Everything Local home">
            <Logo size="sm" />
          </Link>
        )}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!authChecked ? (
            <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : (
            <>
              {user && (
                <span className="text-sm text-gray-600 hidden sm:block max-w-[220px] truncate">
                  Hello, <strong>{user.name}</strong>
                </span>
              )}
              {/* Icons show for everyone — guests get routed to log in when a page
                  needs an account. (Replaces the old green "Log in" button.) */}
              {/* One inbox icon — messages + notifications/offers live together now. */}
              <Link href="/messages" data-tour="messages" title="Messages & notifications" className="relative text-gray-700 hover:text-gray-900 transition-colors">
                <MessageCircle className="w-6 h-6" strokeWidth={2} />
                {msgUnread + notifUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {msgUnread + notifUnread > 9 ? "9+" : msgUnread + notifUnread}
                  </span>
                )}
              </Link>
              <Link href="/wishlist" data-tour="wishlist" title="Wish List" className="relative text-green-600 hover:text-green-700 transition-colors">
                <Heart className="w-6 h-6" strokeWidth={2} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </Link>
              {/* ☰ menu — Dashboard, nav, and Log Out/Log In in one place. */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen((v) => !v)} data-tour="menu" aria-label="Menu" aria-expanded={menuOpen} className="p-1 -mr-1 text-gray-700 hover:text-gray-900 transition-colors">
                  <Menu className="w-7 h-7" strokeWidth={1.8} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                    {shareSlides.length > 0 && (
                      <>
                        <button
                          onClick={() => { setShareOpen(true); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                        >
                          <QrGlyph className="w-4 h-4 text-gray-700 shrink-0" /> Share
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                      </>
                    )}
                    {myVendor && (
                      <>
                        <Link href="/dashboard/vendor?tab=listings" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">📦 Listings</Link>
                        <Link href="/dashboard/vendor?tab=orders" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🧾 Orders</Link>
                      </>
                    )}
                    <Link href={`/community/${activeCity}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🏘️ Local Pages</Link>
                    <div className="border-t border-gray-100 my-1" />
                    {user ? (
                      <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">🚪 Log Out</button>
                    ) : (
                      <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors">🔑 Log in</Link>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
