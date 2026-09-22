"use client";

import { useState } from "react";
import Link from "next/link";

// Persistent green "+" quick-add button. Tapping it opens a small chooser so the
// seller knows their options: open a FREE business storefront, or just post as a
// private seller (one item, no business account). `positionClass` lets each host
// clear its own fixed bars (e.g. the home page's mobile bottom bar).
export default function QuickSellFab({
  positionClass = "bottom-6 right-4 sm:right-6",
  label = "Sell an item",
}: {
  positionClass?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        className={`fixed z-40 ${positionClass} flex items-center justify-center w-14 h-14 rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 ring-4 ring-white/70 hover:bg-green-700 active:scale-95 transition-all`}
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="How do you want to sell?"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xl leading-none transition-colors"
            >
              ×
            </button>

            <h2 className="text-lg font-bold text-gray-900">List something for sale</h2>
            <p className="text-sm text-gray-500 mt-1 mb-5">Pick how you want to sell — you can always switch later.</p>

            {/* Business path — free storefront */}
            <Link
              href="/onboarding/vendor"
              className="block rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3.5 hover:bg-green-100 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-green-800">🏪 Open a business storefront <span className="text-[11px] font-bold bg-green-600 text-white rounded-full px-2 py-0.5">FREE</span></span>
              <span className="block text-xs text-green-700 mt-0.5">Your own page, unlimited listings, orders &amp; messaging — free to start.</span>
            </Link>

            {/* Private seller path */}
            <Link
              href="/sell"
              className="block rounded-xl border border-gray-200 px-4 py-3.5 mt-3 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">🏷️ Post as a private seller</span>
              <span className="block text-xs text-gray-500 mt-0.5">List one item fast — no business account needed.</span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
