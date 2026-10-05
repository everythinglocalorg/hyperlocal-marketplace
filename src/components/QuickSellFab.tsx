"use client";

import { useState } from "react";
import SellMenu from "./SellMenu";

// Persistent green "+" quick-add button (desktop). Opens the shared SellMenu so
// the user can choose what to post — item, event, job, food truck, thrift,
// housing, or a full business storefront. `positionClass` lets each host clear
// its own fixed bars.
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
        className={`fixed z-40 ${positionClass} hidden md:flex items-center justify-center w-14 h-14 rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 ring-4 ring-white/70 hover:bg-green-700 active:scale-95 transition-all`}
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <SellMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
