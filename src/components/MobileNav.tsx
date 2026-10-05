"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Plus, Mail, Smile } from "lucide-react";
import SellMenu from "./SellMenu";

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
  const isDiscover = pathname.startsWith("/discover");
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
        <Link href="/discover" className={`${base} ${isDiscover ? on : off}`}>
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
        <Link href="/dashboard/vendor" className={`${base} ${isSpace ? on : off}`}>
          <Smile className="w-6 h-6" strokeWidth={2} />
          <span className="text-[10px] font-medium">My Space</span>
        </Link>
      </nav>

      <SellMenu open={sellOpen} onClose={() => setSellOpen(false)} />
    </>
  );
}
