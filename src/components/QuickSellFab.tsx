"use client";

import Link from "next/link";

// Persistent green "+" quick-add button — anyone can list an item for sale in a
// couple taps. Links to /sell (which sends guests through login first). Shown on
// the home page and the product/listings browse. `positionClass` lets each host
// clear its own fixed bars (e.g. the home page's mobile bottom bar).
export default function QuickSellFab({
  positionClass = "bottom-6 right-4 sm:right-6",
  label = "Sell an item",
}: {
  positionClass?: string;
  label?: string;
}) {
  return (
    <Link
      href="/sell"
      aria-label={label}
      title={label}
      className={`fixed z-40 ${positionClass} flex items-center justify-center w-14 h-14 rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 ring-4 ring-white/70 hover:bg-green-700 active:scale-95 transition-all`}
    >
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Link>
  );
}
