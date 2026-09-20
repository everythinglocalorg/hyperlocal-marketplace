"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BOOST_PLACEMENTS, computeBoostCharge, LB_BOOST_MAX_PCT } from "@/lib/boosts";

// Purchase a monthly feature boost for a listing or a vendor. Local Bucks can
// cover up to 15% of the first month (1 LB = $1); the rest goes to Stripe.
// Redirects to Stripe Checkout; the webhook activates the boost once paid.
export default function BoostModal({ entityType, entityId, homepageLabel, returnPath, onClose }: {
  entityType: "listing" | "vendor";
  entityId: string;
  homepageLabel: string; // "Featured Gems" for a product, "New Businesses" for a business
  returnPath: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [useLB, setUseLB] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("local_bucks").eq("id", user.id).single();
      setBalance(data?.local_bucks ?? 0);
    })();
  }, []);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  async function startBoost(placement: "homepage" | "local_pages", appliedLB: number) {
    setLoading(placement);
    setError(null);
    try {
      const res = await fetch("/api/boosts/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, placement, return_path: returnPath, apply_local_bucks: appliedLB }),
      });
      const out = await res.json();
      if (out.url) { window.location.href = out.url; return; }
      setError(out.error ?? "Could not start checkout. Please try again.");
    } catch {
      setError("Could not reach checkout. Please try again.");
    }
    setLoading(null);
  }

  const options = (["homepage", "local_pages"] as const).map((placement) => ({
    placement,
    title: placement === "homepage" ? `Feature in ${homepageLabel}` : "Feature on Local Pages",
    sub: placement === "homepage" ? "Shown first on the homepage for your town." : "Pinned on your town's Local Pages board.",
    charge: computeBoostCharge(placement, useLB ? balance : 0, balance),
  }));
  const anyLbEligible = options.some((o) => computeBoostCharge(o.placement, balance, balance).maxLB > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-black text-gray-900">🚀 Boost your {entityType === "vendor" ? "business" : "product"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Get seen first by local customers. Billed monthly — cancel anytime.</p>

        {/* Local Bucks */}
        <div className="flex items-center justify-between gap-3 mb-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-amber-800">🪙 {balance.toLocaleString()} Local Bucks</p>
            <p className="text-[11px] text-amber-600">Cover up to {Math.round(LB_BOOST_MAX_PCT * 100)}% of the first month (1 🪙 = $1).</p>
          </div>
          <label className={`flex items-center gap-2 text-xs font-semibold ${anyLbEligible ? "text-amber-800 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}>
            <input type="checkbox" checked={useLB} disabled={!anyLbEligible} onChange={(e) => setUseLB(e.target.checked)} className="accent-amber-500" />
            Apply
          </label>
        </div>

        <div className="space-y-3">
          {options.map((o) => (
            <button
              key={o.placement}
              onClick={() => startBoost(o.placement, o.charge.appliedLB)}
              disabled={!!loading}
              className="w-full flex items-center gap-3 text-left border-2 border-gray-100 hover:border-green-400 rounded-2xl p-4 transition-colors disabled:opacity-50"
            >
              <div className="flex-1">
                <p className="font-bold text-gray-900">{o.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{o.sub}</p>
                {o.charge.appliedLB > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">{o.charge.appliedLB} 🪙 applied — first month {fmt(o.charge.firstChargeCents)}, then {fmt(o.charge.priceCents)}/mo</p>
                )}
              </div>
              <span className="shrink-0 bg-green-600 text-white font-black text-sm px-3 py-1.5 rounded-full">
                {loading === o.placement ? "…" : `${fmt(o.charge.firstChargeCents)}`}
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
