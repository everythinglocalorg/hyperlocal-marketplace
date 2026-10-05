"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, PartyPopper, Briefcase, Truck, UtensilsCrossed, ShoppingBag, Home, Store, Wrench, ArrowRight, X } from "lucide-react";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";

// Shared "what do you want to post?" sheet, opened from the Sell "+" (mobile
// bottom nav) and the desktop quick-add button. One bar per path, top-down, each
// routing to the right place to start a listing / post / storefront.
export default function SellMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [city, setCity] = useState(DEFAULT_CITY_SLUG);

  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LS_CITY_KEY);
      if (saved) setCity(saved);
    } catch { /* no saved city */ }
  }, [open]);

  if (!open) return null;

  const rows: { label: string; sub: string; href: string; Icon: typeof Package; highlight?: boolean }[] = [
    { label: "Sell Something", sub: "List an item — no business account needed", href: "/sell", Icon: Package },
    { label: "Offer a Service", sub: "Trades, cleaning, lessons & more", href: "/list?type=service", Icon: Wrench },
    { label: "Post An Event", sub: "Share a local happening", href: "/list?type=event", Icon: PartyPopper },
    { label: "Post a Job", sub: "Hiring help in your town", href: `/jobs/${city}`, Icon: Briefcase },
    { label: "Share My Food Truck", sub: "Go live and share your spot", href: "/dashboard/vendor?tab=foodtruck", Icon: Truck },
    { label: "Add My Restaurant", sub: "Post your menu & dishes", href: "/dashboard/vendor?tab=listings&new=restaurant", Icon: UtensilsCrossed },
    { label: "Share a Thrift Sale", sub: "Post a one-of-a-kind find", href: "/list?type=thrift", Icon: ShoppingBag },
    { label: "Housing / Rentals", sub: "List a home or rental property", href: "/list?type=housing_rent", Icon: Home },
    { label: "Launch Your Business on Everything Local", sub: "Free storefront, unlimited listings", href: "/onboarding/vendor", Icon: Store, highlight: true },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="What do you want to post?"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">What would you like to post?</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pick one to get started.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {rows.map(({ label, sub, href, Icon, highlight }) => (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors ${
                highlight
                  ? "border-2 border-green-500 bg-green-50 hover:bg-green-100"
                  : "border border-gray-200 hover:border-green-300 hover:bg-green-50/40"
              }`}
            >
              <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${highlight ? "bg-green-600 text-white" : "bg-green-50 text-green-700"}`}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${highlight ? "text-green-800" : "text-gray-900"}`}>{label}</span>
                <span className={`block text-xs ${highlight ? "text-green-700" : "text-gray-500"}`}>{sub}</span>
              </span>
              <ArrowRight className={`w-4 h-4 shrink-0 ${highlight ? "text-green-700" : "text-gray-300"}`} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
