"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Plus, Mail, Smile } from "lucide-react";

// Native-style bottom tab bar — mobile only. Home · Discover (map) · Sell (+) ·
// Inbox · My Space (your dashboard). Hidden on full-chrome flows (auth,
// onboarding, proposal) where a tab bar would get in the way. The Sell "+"
// opens the same storefront-vs-private-seller chooser as the desktop quick-add.
const HIDDEN_PREFIXES = ["/login", "/signup", "/reset-password", "/auth", "/callback", "/onboarding", "/proposal"];

export default function MobileNav() {
  const pathname = usePathname() || "/";
  const [sellOpen, setSellOpen] = useState(false);
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  const isHome = pathname === "/";
  const isDiscover = pathname.startsWith("/search");
  const isInbox = pathname.startsWith("/messages");
  const isSpace = pathname.startsWith("/dashboard");

  const base = "flex-1 flex flex-col items-center justify-end gap-0.5 py-2";
  const on = "text-green-600";
  const off = "text-gray-400";

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        <Link href="/" className={`${base} ${isHome ? on : off}`}>
          <Home className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/search?mode=listings" className={`${base} ${isDiscover ? on : off}`}>
          <Map className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">Discover</span>
        </Link>
        <button type="button" onClick={() => setSellOpen(true)} aria-label="Sell an item" className={base}>
          <span className="w-11 h-11 -mt-3.5 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/30">
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </span>
          <span className={`text-[10px] font-medium ${off}`}>Sell</span>
        </button>
        <Link href="/messages" className={`${base} ${isInbox ? on : off}`}>
          <Mail className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">Inbox</span>
        </Link>
        <Link href="/dashboard/buyer" className={`${base} ${isSpace ? on : off}`}>
          <Smile className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">My Space</span>
        </Link>
      </nav>

      {sellOpen && (
        <div className="md:hidden fixed inset-0 z-[70] bg-black/50 flex items-end justify-center p-4" role="dialog" aria-modal="true" aria-label="How do you want to sell?" onClick={() => setSellOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative mb-16" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSellOpen(false)} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
            <h2 className="text-lg font-bold text-gray-900">List something for sale</h2>
            <p className="text-sm text-gray-500 mt-1 mb-5">Pick how you want to sell — you can always switch later.</p>
            <Link href="/onboarding/vendor" className="block rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3.5 hover:bg-green-100 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold text-green-800">🏪 Open a business storefront <span className="text-[11px] font-bold bg-green-600 text-white rounded-full px-2 py-0.5">FREE</span></span>
              <span className="block text-xs text-green-700 mt-0.5">Your own page, unlimited listings, orders and messaging — free to start.</span>
            </Link>
            <Link href="/sell" className="block rounded-xl border border-gray-200 px-4 py-3.5 mt-3 hover:border-gray-400 hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">🏷️ Post as a private seller</span>
              <span className="block text-xs text-gray-500 mt-0.5">List one item fast — no business account needed.</span>
            </Link>
            <button type="button" onClick={() => setSellOpen(false)} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4">Maybe later</button>
          </div>
        </div>
      )}
    </>
  );
}
