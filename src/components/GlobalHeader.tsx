"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";

// Routes that render their own full-page chrome (own nav/sidebar) and should NOT
// show the global browse header.
const HIDDEN_PREFIXES = [
  "/dashboard", "/admin", "/onboarding", "/login", "/signup",
  "/connect-domain", "/u/", "/profile", "/reset-password", "/auth",
  // Static/utility pages that already render their own full nav bar
  "/notifications", "/about", "/pricing", "/contact", "/terms", "/privacy",
  // Storefront pages render their own unified header with a site menu (hamburger)
  "/vendors/",
];

export default function GlobalHeader() {
  const pathname = usePathname() || "/";
  const [user, setUser] = useState<{ id: string; name: string | null; role: string | null } | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          .from("profiles").select("full_name, role, default_city").eq("id", u.id).single();
        setUser({ id: u.id, name: profile?.full_name ?? u.email ?? null, role: profile?.role ?? null });
        if (profile?.default_city) setActiveCity(profile.default_city);
        supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("user_id", u.id).eq("is_read", false)
          .then(({ count }) => setNotifUnread(count ?? 0));
      }
      setAuthChecked(true);
    });
  }, [pathname]);

  // Hide on routes with their own chrome
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center min-w-0 shrink" aria-label="Everything Local home">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!authChecked ? (
            <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:block max-w-[220px] truncate">
                Hello, <strong>{user.name}</strong>
              </span>
              <Link
                href={user.role === "vendor" ? "/dashboard/vendor?tab=messages" : "/dashboard/buyer?tab=messages"}
                title="Messages" className="relative text-xl leading-none"
              >
                💬
              </Link>
              <Link href="/notifications" title="Notifications" className="relative text-xl leading-none">
                🔔
                {notifUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {notifUnread > 9 ? "9+" : notifUnread}
                  </span>
                )}
              </Link>
              {/* Desktop: nav pills + Dashboard button */}
              <Link href={`/community/${activeCity}`} className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden lg:block">
                🏘️ Local Loop
              </Link>
              <Link href={`/jobs/${activeCity}`} className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden lg:block">
                💼 Local Jobs
              </Link>
              <Link href={`/explore/${activeCity}`} className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden lg:block">
                🌿 Explore
              </Link>
              <Link href={user.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"} className="text-sm bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors whitespace-nowrap hidden lg:block">
                Dashboard →
              </Link>

              {/* Mobile: ☰ menu — Dashboard + nav in one place */}
              <div className="relative lg:hidden" ref={menuRef}>
                <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen} className="p-1 -mr-1 text-gray-700 hover:text-gray-900 transition-colors">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                    <Link href={user.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors">📊 Dashboard →</Link>
                    <div className="border-t border-gray-100 my-1" />
                    <Link href={`/community/${activeCity}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🏘️ Local Loop</Link>
                    <Link href={`/jobs/${activeCity}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">💼 Local Jobs</Link>
                    <Link href={`/explore/${activeCity}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">🌿 Explore</Link>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
              <Link href="/signup" className="text-sm bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
