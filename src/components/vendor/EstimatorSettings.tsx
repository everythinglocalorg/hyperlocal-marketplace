"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstimateSettings, DEFAULT_SETTINGS } from "@/lib/estimate-pricing";

// Per-vendor estimating defaults used across the price book and new proposals.
export default function EstimatorSettings({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [settings, setSettings] = useState<EstimateSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("estimate_settings").select("*").eq("vendor_id", vendorId).maybeSingle()
      .then(({ data }) => {
        if (data) setSettings({
          default_labor_rate: Number(data.default_labor_rate) || 0,
          hourly_cost_rate: Number(data.hourly_cost_rate) || 0,
          default_markup_pct: Number(data.default_markup_pct) || 0,
          tax_rate_pct: Number(data.tax_rate_pct) || 0,
          min_job_price: Number(data.min_job_price) || 0,
          default_deposit_pct: data.default_deposit_pct ?? 50,
        });
        setLoading(false);
      });
  }, [vendorId, supabase]);

  function set(patch: Partial<EstimateSettings>) { setSettings((s) => ({ ...s, ...patch })); setSaved(false); }

  async function save() {
    setSaving(true);
    await supabase.from("estimate_settings").upsert({ vendor_id: vendorId, ...settings, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  const fields: { key: keyof EstimateSettings; label: string; hint: string; prefix?: string; suffix?: string }[] = [
    { key: "default_labor_rate", label: "Default labor rate (billed)", hint: "What you charge per hour. Applied to new substrates and price-book items.", prefix: "$", suffix: "/hr" },
    { key: "hourly_cost_rate", label: "Hourly cost rate (paid)", hint: "What you actually pay per hour. Used for profit in Job Metrics.", prefix: "$", suffix: "/hr" },
    { key: "default_markup_pct", label: "Default markup", hint: "Added on top of product cost.", suffix: "%" },
    { key: "tax_rate_pct", label: "Sales tax rate", hint: "Shown on proposals where applicable.", suffix: "%" },
    { key: "min_job_price", label: "Minimum job price", hint: "A floor for the proposal total.", prefix: "$" },
    { key: "default_deposit_pct", label: "Default deposit", hint: "Pre-selected on new proposals.", suffix: "%" },
  ];

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 mb-5">Defaults that speed up estimating. You can still override any value on an individual proposal.</p>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{f.label}</p>
              <p className="text-xs text-gray-400">{f.hint}</p>
            </div>
            <div className="relative shrink-0 w-32">
              {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.prefix}</span>}
              <input type="number" min={0} step="0.01" value={settings[f.key]}
                onChange={(e) => set({ [f.key]: Number(e.target.value) } as Partial<EstimateSettings>)}
                className={`w-full border border-gray-200 rounded-lg ${f.prefix ? "pl-7" : "pl-3"} ${f.suffix ? "pr-9" : "pr-3"} py-2 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-green-500`} />
              {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        className="mt-5 bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save settings"}
      </button>
    </div>
  );
}
