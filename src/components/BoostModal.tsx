"use client";

import { useState } from "react";
import { BOOST_PLACEMENTS } from "@/lib/boosts";

// Purchase a monthly feature boost for a listing or a vendor. Redirects to
// Stripe Checkout; the webhook activates the boost once paid.
export default function BoostModal({ entityType, entityId, homepageLabel, returnPath, onClose }: {
  entityType: "listing" | "vendor";
  entityId: string;
  homepageLabel: string; // "Featured Gems" for a product, "New Businesses" for a business
  returnPath: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startBoost(placement: "homepage" | "local_pages") {
    setLoading(placement);
    setError(null);
    try {
      const res = await fetch("/api/boosts/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, placement, return_path: returnPath }),
      });
      const out = await res.json();
      if (out.url) { window.location.href = out.url; return; }
      setError(out.error ?? "Could not start checkout. Please try again.");
    } catch {
      setError("Could not reach checkout. Please try again.");
    }
    setLoading(null);
  }

  const options = [
    { placement: "homepage" as const, title: `Feature in ${homepageLabel}`, sub: "Shown first on the homepage for your town.", price: BOOST_PLACEMENTS.homepage.priceLabel },
    { placement: "local_pages" as const, title: "Feature on Local Pages", sub: "Pinned on your town's Local Pages board.", price: BOOST_PLACEMENTS.local_pages.priceLabel },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-black text-gray-900">🚀 Boost your {entityType === "vendor" ? "business" : "product"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Get seen first by local customers. Billed monthly — cancel anytime.</p>
        <div className="space-y-3">
          {options.map((o) => (
            <button
              key={o.placement}
              onClick={() => startBoost(o.placement)}
              disabled={!!loading}
              className="w-full flex items-center gap-3 text-left border-2 border-gray-100 hover:border-green-400 rounded-2xl p-4 transition-colors disabled:opacity-50"
            >
              <div className="flex-1">
                <p className="font-bold text-gray-900">{o.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{o.sub}</p>
              </div>
              <span className="shrink-0 bg-green-600 text-white font-black text-sm px-3 py-1.5 rounded-full">
                {loading === o.placement ? "…" : o.price}
              </span>
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <p className="text-[11px] text-gray-400 text-center mt-4">Secured by Stripe · Cancel anytime</p>
      </div>
    </div>
  );
}
