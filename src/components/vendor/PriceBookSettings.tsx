"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogItem, UnitBasis, UNIT_LABEL } from "@/lib/estimate-pricing";

// The per-vendor "price book". Vendors define their own substrates + products so
// the proposal builder can auto-calculate line totals. Items are grouped by
// substrate; the substrate list is simply the distinct substrates in use.

const UNIT_OPTIONS: UnitBasis[] = ["sqft", "linear_ft", "each", "hour"];

type Draft = Omit<CatalogItem, "id" | "vendor_id" | "is_active"> & { id?: string };

function blankDraft(substrate = "General"): Draft {
  return {
    substrate,
    name: "",
    unit_basis: "sqft",
    spread_rate: null,
    cost_of_goods: 0,
    labor_rate: 0,
    markup_pct: 0,
    default_coats: 1,
    product_line: null,
  };
}

interface Props { vendorId: string; }

export default function PriceBookSettings({ vendorId }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("estimate_catalog_items")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("is_active", true)
      .order("substrate")
      .order("name");
    setItems((data as CatalogItem[]) ?? []);
    setLoading(false);
  }

  const substrates = useMemo(() => {
    const set = new Set<string>(items.map((i) => i.substrate).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const it of items) {
      const arr = map.get(it.substrate) ?? [];
      arr.push(it);
      map.set(it.substrate, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  async function save(draft: Draft) {
    if (!draft.name.trim()) return;
    setSaving(true);
    const payload = {
      vendor_id: vendorId,
      substrate: draft.substrate.trim() || "General",
      name: draft.name.trim(),
      unit_basis: draft.unit_basis,
      spread_rate: draft.spread_rate === null || Number.isNaN(draft.spread_rate) ? null : Number(draft.spread_rate),
      cost_of_goods: Number(draft.cost_of_goods) || 0,
      labor_rate: Number(draft.labor_rate) || 0,
      markup_pct: Number(draft.markup_pct) || 0,
      default_coats: Number(draft.default_coats) || 1,
      product_line: draft.product_line?.trim() || null,
    };
    if (draft.id) {
      await supabase.from("estimate_catalog_items").update(payload).eq("id", draft.id);
      setItems((prev) => prev.map((i) => (i.id === draft.id ? { ...i, ...payload } : i)));
    } else {
      const { data } = await supabase.from("estimate_catalog_items").insert(payload).select("*").single();
      if (data) setItems((prev) => [...prev, data as CatalogItem]);
    }
    setSaving(false);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from your price book?")) return;
    await supabase.from("estimate_catalog_items").update({ is_active: false }).eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Price Book</h2>
          <p className="text-sm text-gray-500 mt-0.5 max-w-lg">
            Set up your products once. The estimate builder uses these to auto-calculate
            line totals from measurements, coats, spread rate, cost, labor and markup.
          </p>
        </div>
        <button onClick={() => setEditing(blankDraft(substrates[0]))}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">
          + Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🎨</p>
          <p className="font-semibold text-gray-600 mb-1">No products yet</p>
          <p className="text-sm">Add your materials and services to build estimates in seconds.</p>
          <button onClick={() => setEditing(blankDraft())} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">Add your first item</button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([substrate, list]) => (
            <div key={substrate}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{substrate}</h3>
                <span className="text-xs text-gray-300">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((it) => (
                  <div key={it.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{it.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{UNIT_LABEL[it.unit_basis]}</span>
                      </div>
                      {it.product_line && <p className="text-xs text-gray-400 truncate">{it.product_line}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {it.spread_rate ? `${it.spread_rate} /unit · ` : ""}
                        COGS ${Number(it.cost_of_goods).toFixed(2)} · Labor ${Number(it.labor_rate).toFixed(2)} · {it.markup_pct}% markup · {it.default_coats} coat{it.default_coats === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditing({ ...it })} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                      <button onClick={() => remove(it.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ItemEditor
          draft={editing}
          substrates={substrates}
          saving={saving}
          onChange={setEditing}
          onSave={() => save(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ItemEditor({ draft, substrates, saving, onChange, onSave, onClose }: {
  draft: Draft; substrates: string[]; saving: boolean;
  onChange: (d: Draft) => void; onSave: () => void; onClose: () => void;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const coverage = draft.unit_basis === "sqft" || draft.unit_basis === "linear_ft";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{draft.id ? "Edit product" : "New product"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <Field label="Product name">
            <input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Loxon XP Masonry Coat" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Substrate">
              <input list="pb-substrates" value={draft.substrate} onChange={(e) => set({ substrate: e.target.value })}
                placeholder="Concrete" className={inputCls} />
              <datalist id="pb-substrates">
                {substrates.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Product line / brand">
              <input value={draft.product_line ?? ""} onChange={(e) => set({ product_line: e.target.value })}
                placeholder="Sherwin Williams" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit basis">
              <select value={draft.unit_basis} onChange={(e) => set({ unit_basis: e.target.value as UnitBasis })} className={inputCls}>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
              </select>
            </Field>
            <Field label="Default coats">
              <input type="number" min={1} value={draft.default_coats}
                onChange={(e) => set({ default_coats: Number(e.target.value) })} className={inputCls} />
            </Field>
          </div>

          {coverage && (
            <Field label={`Spread rate (${UNIT_LABEL[draft.unit_basis]} per unit of material)`} hint="e.g. 250 sq ft per gallon">
              <input type="number" min={0} step="0.01" value={draft.spread_rate ?? ""}
                onChange={(e) => set({ spread_rate: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="250" className={inputCls} />
            </Field>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label={coverage ? "Cost / material unit" : "Cost / unit"}>
              <MoneyInput value={draft.cost_of_goods} onChange={(v) => set({ cost_of_goods: v })} />
            </Field>
            <Field label={`Labor / ${UNIT_LABEL[draft.unit_basis]}`}>
              <MoneyInput value={draft.labor_rate} onChange={(v) => set({ labor_rate: v })} />
            </Field>
            <Field label="Markup %">
              <input type="number" min={0} step="1" value={draft.markup_pct}
                onChange={(e) => set({ markup_pct: Number(e.target.value) })} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onSave} disabled={saving || !draft.name.trim()}
            className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save product"}
          </button>
          <button onClick={onClose} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 block mb-1">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-400 block mt-1">{hint}</span>}
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <input type="number" min={0} step="0.01" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );
}
