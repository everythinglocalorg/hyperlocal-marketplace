"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Substrate, UnitBasis, CALC_TYPE_LABEL } from "@/lib/estimate-pricing";

const CALC_TYPES: UnitBasis[] = ["sqft", "linear_ft", "each", "hour"];
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

type Draft = { id?: string; name: string; calc_type: UnitBasis; production_rate: number; labor_rate: number; width_inches: number };

function blank(): Draft { return { name: "", calc_type: "sqft", production_rate: 0, labor_rate: 0, width_inches: 0 }; }

// Unit noun for a calc type, used in labels like "square feet per hour".
function unitNoun(t: UnitBasis): string {
  return t === "sqft" ? "square feet" : t === "linear_ft" ? "linear feet" : t === "each" ? "items" : "hours";
}

// Substrates ("categories") define how work is measured and how fast it's done —
// generalized for any trade (painting, concrete, lawncare, framing…).
export default function SubstrateManager({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Substrate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("estimate_substrates").select("*").eq("vendor_id", vendorId).eq("is_active", true).order("name");
    setItems((data as Substrate[]) ?? []);
    setLoading(false);
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    const payload = {
      vendor_id: vendorId, name: editing.name.trim(), calc_type: editing.calc_type,
      production_rate: Number(editing.production_rate) || 0, labor_rate: Number(editing.labor_rate) || 0,
      width_inches: editing.calc_type === "linear_ft" ? (Number(editing.width_inches) || 0) : null,
    };
    if (editing.id) {
      await supabase.from("estimate_substrates").update(payload).eq("id", editing.id);
      setItems((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...payload } : s)));
    } else {
      const { data } = await supabase.from("estimate_substrates").insert(payload).select("*").single();
      if (data) setItems((prev) => [...prev, data as Substrate]);
    }
    setSaving(false);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this substrate?")) return;
    await supabase.from("estimate_substrates").update({ is_active: false }).eq("id", id);
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4">
        <p className="text-sm text-gray-500 max-w-lg">
          A substrate is a type of work (Trim, Walls, Concrete, Lawn…). Set how it&apos;s measured and how
          much your crew completes in an hour — the builder turns measurements into labor time automatically.
        </p>
        <button onClick={() => setEditing(blank())}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">+ Add Substrate</button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-14 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🧱</p>
          <p className="font-semibold text-gray-600 mb-1">No substrates yet</p>
          <p className="text-sm">Add the kinds of work you do and how fast you do them.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{CALC_TYPE_LABEL[s.calc_type]}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {Number(s.width_inches) > 0 ? `${s.width_inches}" wide · ` : ""}
                  {s.production_rate > 0 ? `${s.production_rate} ${Number(s.width_inches) > 0 ? "square feet" : unitNoun(s.calc_type)}/hr · ` : ""}${Number(s.labor_rate).toFixed(2)}/hr labor
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing({ id: s.id, name: s.name, calc_type: s.calc_type, production_rate: s.production_rate, labor_rate: s.labor_rate, width_inches: Number(s.width_inches) || 0 })} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                <button onClick={() => remove(s.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing.id ? "Edit substrate" : "New substrate"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Substrate name</span>
                <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Trim, Walls, Concrete, Lawn" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Default calculation type</span>
                <select value={editing.calc_type} onChange={(e) => setEditing({ ...editing, calc_type: e.target.value as UnitBasis })} className={inputCls}>
                  {CALC_TYPES.map((t) => <option key={t} value={t}>{CALC_TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              {editing.calc_type === "linear_ft" && (
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 block mb-1">Width (inches)</span>
                  <input type="number" min={0} step="0.25" value={editing.width_inches}
                    onChange={(e) => setEditing({ ...editing, width_inches: Number(e.target.value) })}
                    placeholder="e.g. 4" className={inputCls} />
                  <span className="text-[11px] text-gray-400 block mt-1">Converts linear feet to square feet (LF × in ÷ 12) so your sq-ft production rate applies. Leave 0 to rate per linear foot.</span>
                </label>
              )}
              {editing.calc_type !== "hour" && (
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 block mb-1">
                    Production rate ({editing.calc_type === "linear_ft" && editing.width_inches > 0 ? "square feet" : unitNoun(editing.calc_type)} per hour)
                  </span>
                  <input type="number" min={0} step="0.01" value={editing.production_rate}
                    onChange={(e) => setEditing({ ...editing, production_rate: Number(e.target.value) })}
                    placeholder="e.g. 200" className={inputCls} />
                  <span className="text-[11px] text-gray-400 block mt-1">How many {editing.calc_type === "linear_ft" && editing.width_inches > 0 ? "square feet" : unitNoun(editing.calc_type)} your crew completes in one hour.</span>
                </label>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Labor rate ($ per hour)</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={editing.labor_rate}
                    onChange={(e) => setEditing({ ...editing, labor_rate: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={save} disabled={saving || !editing.name.trim()} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
