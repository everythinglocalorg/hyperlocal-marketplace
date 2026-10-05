"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Sellers save how they want to get paid for direct (peer-to-peer) sales. Stored
// on vendors.payment_handles (jsonb); surfaced to buyers via <PaymentOptions/>.
export default function PaymentHandlesEditor({ vendor }: { vendor: any }) {
  const supabase = createClient();
  const h = vendor.payment_handles ?? {};
  const [venmo, setVenmo] = useState<string>(h.venmo ?? "");
  const [cashapp, setCashapp] = useState<string>(h.cashapp ?? "");
  const [zelle, setZelle] = useState<string>(h.zelle ?? "");
  const [appleCash, setAppleCash] = useState<boolean>(!!h.accepts_apple_cash);
  const [cash, setCash] = useState<boolean>(h.accepts_cash !== false); // default on
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    const payload = {
      venmo: venmo.trim().replace(/^@/, "") || null,
      cashapp: cashapp.trim().replace(/^\$/, "") || null,
      zelle: zelle.trim() || null,
      accepts_apple_cash: appleCash,
      accepts_cash: cash,
    };
    const { error: err } = await supabase.from("vendors").update({ payment_handles: payload }).eq("id", vendor.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900">Get paid</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-4">
        How buyers pay you for direct sales. We don’t take a cut — payment goes straight to you. Add any that apply.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Venmo username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input value={venmo} onChange={(e) => setVenmo(e.target.value)} placeholder="your-venmo" className={`${inputCls} pl-7`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cash App $cashtag</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input value={cashapp} onChange={(e) => setCashapp(e.target.value)} placeholder="yourcashtag" className={`${inputCls} pl-7`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Zelle (email or phone)</label>
          <input value={zelle} onChange={(e) => setZelle(e.target.value)} placeholder="you@email.com" className={inputCls} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={appleCash} onChange={(e) => setAppleCash(e.target.checked)} className="rounded" />
          Accept Apple Cash (buyers text you to send it)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="rounded" />
          Accept cash at pickup
        </label>
      </div>

      {appleCash && !vendor.phone && (
        <p className="text-xs text-amber-600 mt-3">Add a phone number above so buyers can text you for Apple Cash.</p>
      )}
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      <button onClick={save} disabled={saving} className="mt-4 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save payment options"}
      </button>
    </div>
  );
}
