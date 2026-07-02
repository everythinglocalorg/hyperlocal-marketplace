"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";

// Routes that render their own full-page chrome (own nav/sidebar) and should NOT
// show the global browse header.
const HIDDEN_PREFIXES = [
  "/dashboard", "/admin", "/onboarding", "/login", "/signup",
  "/connect-domain", "/u/", "/profile", "/reset-password", "/auth",
  // Static/utility pages that already render their own full nav bar
  "/notifications", "/about", "/pricing", "/contact", "/terms", "/privacy",
];

export default function GlobalHeader() {
  const pathname = usePathname() || "/";
  const [user, setUser] = useState<{ id: string; name: string | null; role: string | null } | null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY_SLUG);

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
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <span className="text-lg sm:text-2xl font-bold text-green-600 truncate">Everything Local</span>
          <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 rounded-full font-medium shrink-0">BETA</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!authChecked ? (
            <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">
                Hello, <strong>{user.name?.split(" ")[0]}</strong>
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
              {/* Neighborhood icon: mobile only (desktop uses the pill) */}
              <Link href={`/community/${activeCity}`} title="Neighborhood Chat" className="relative text-xl leading-none lg:hidden">
                🏘️
              </Link>
              <Link
                href={`/community/${activeCity}`}
                className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden lg:block"
              >
                🏘️ Ask Your Neighbors
              </Link>
              <Link
                href={`/jobs/${activeCity}`}
                className="text-sm font-semibold text-green-700 border border-green-300 px-4 py-2 rounded-full hover:bg-green-50 transition-colors hidden lg:block"
              >
                💼 Local Jobs
              </Link>
              <Link
                href={user.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer"}
                className="text-sm bg-green-600 text-white px-3 sm:px-4 py-2 rounded-full hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                <span className="hidden sm:inline">My Local Activity →</span>
                <span className="sm:hidden">Activity →</span>
              </Link>
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
