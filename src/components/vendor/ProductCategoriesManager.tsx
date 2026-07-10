"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ListingCategory = { id: string; name: string; position: number };

// Vendor-defined product categories (e.g. "Heat & Eat Family Packs"). Vendors
// create/rename/reorder them here; listings get assigned to one in the listing
// form, and the public profile shows them as a filter nav over the grid.
export default function ProductCategoriesManager({
  vendorId, categories, onChange,
}: {
  vendorId: string; categories: ListingCategory[]; onChange: () => void;
}) {
  const supabase = createClient();
  const [adding, setAdding] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const name = adding.trim();
    if (!name || busy) return;
    setBusy(true);
    const nextPos = categories.length ? Math.max(...categories.map((c) => c.position)) + 1 : 0;
    await supabase.from("listing_categories").insert({ vendor_id: vendorId, name, position: nextPos });
    setAdding("");
    setBusy(false);
    onChange();
  }

  async function rename(id: string) {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;
    await supabase.from("listing_categories").update({ name }).eq("id", id);
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Its listings stay, just uncategorized.")) return;
    await supabase.from("listing_categories").delete().eq("id", id);
    onChange();
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await Promise.all([
      supabase.from("listing_categories").update({ position: b.position }).eq("id", a.id),
      supabase.from("listing_categories").update({ position: a.position }).eq("id", b.id),
    ]);
    onChange();
  }

  const sorted = [...categories].sort((a, b) => a.position - b.position);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-900">Product categories</p>
        <span className="text-xs text-gray-400">{sorted.length} {sorted.length === 1 ? "category" : "categories"}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Group your listings into sections (e.g. “Family Packs”, “A La Carte”). Customers can filter by these on your page.</p>

      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {sorted.map((c, i) => (
            <div key={c.id} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-1.5 py-1">
              <button onClick={() => move(c.id, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs px-0.5" title="Move left">‹</button>
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => rename(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") rename(c.id); if (e.key === "Escape") setEditingId(null); }}
                  className="text-sm bg-white border border-green-300 rounded px-1.5 py-0.5 w-32 focus:outline-none"
                />
              ) : (
                <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="text-sm font-medium text-gray-800 px-1" title="Rename">
                  {c.name}
                </button>
              )}
              <button onClick={() => move(c.id, 1)} disabled={i === sorted.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs px-0.5" title="Move right">›</button>
              <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-500 text-sm leading-none px-0.5" title="Delete">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="New category name…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button onClick={add} disabled={busy || !adding.trim()} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
          + Add
        </button>
      </div>
    </div>
  );
}
