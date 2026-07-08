"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type PlaceRow = {
  id: string; slug: string; name: string; type: string; city: string; state: string;
  is_active: boolean; created_at: string; created_by: string;
  images: string[]; description: string | null;
};

const PLACE_TYPE_LABELS: Record<string, string> = {
  park: "Park", campground: "Campground", attraction: "Attraction",
  thing_to_do: "Thing to Do", food_truck: "Food Truck",
};

const PLACE_TYPE_COLORS: Record<string, string> = {
  park: "bg-green-100 text-green-700",
  campground: "bg-blue-100 text-blue-700",
  attraction: "bg-purple-100 text-purple-700",
  thing_to_do: "bg-amber-100 text-amber-700",
  food_truck: "bg-orange-100 text-orange-700",
};

// Shared admin manager for community "places" (parks, campgrounds, etc.).
// Used in both the /admin panel and the vendor-dashboard sidebar.
export default function PlacesManager({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("places")
      .select("id,slug,name,type,city,state,is_active,created_at,created_by,images,description")
      .order("created_at", { ascending: false });
    setPlaces((data ?? []) as PlaceRow[]);
    setLoading(false);
  }

  async function toggleActive(place: PlaceRow) {
    const newVal = !place.is_active;
    setBusy(place.id);
    await supabase.from("places").update({ is_active: newVal }).eq("id", place.id);
    await supabase.from("admin_logs").insert({
      admin_id: adminId, action: newVal ? "place_activate" : "place_deactivate",
      target_type: "place", target_id: place.id, detail: place.name,
    });
    setPlaces((prev) => prev.map((p) => p.id === place.id ? { ...p, is_active: newVal } : p));
    setBusy(null);
  }

  async function deletePlace(place: PlaceRow) {
    if (!confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    setBusy(place.id);
    await supabase.from("places").delete().eq("id", place.id);
    await supabase.from("admin_logs").insert({
      admin_id: adminId, action: "place_delete",
      target_type: "place", target_id: place.id, detail: place.name,
    });
    setPlaces((prev) => prev.filter((p) => p.id !== place.id));
    setBusy(null);
  }

  const s = search.toLowerCase();
  const filtered = places.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(s) || p.city.toLowerCase().includes(s) || p.type.includes(s);
    const matchType = typeFilter === "all" || p.type === typeFilter;
    return matchSearch && matchType;
  });

  const types = ["all", "park", "campground", "attraction", "thing_to_do", "food_truck"];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search places or city..."
          className="flex-1 min-w-48 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex gap-1.5 flex-wrap">
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${typeFilter === t ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {t === "all" ? "All" : t === "thing_to_do" ? "Thing to Do" : t === "food_truck" ? "Food Truck" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Place</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!p.is_active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <a href={`/places/${p.slug}`} target="_blank" rel="noreferrer"
                      className="text-sm font-semibold text-gray-900 hover:text-green-700 hover:underline">
                      {p.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLACE_TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {PLACE_TYPE_LABELS[p.type] ?? p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{p.city}, {p.state}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={busy === p.id}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${p.is_active ? "bg-green-500" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${p.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <a href={`/places/${p.slug}/edit`} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Edit</a>
                      <button onClick={() => deletePlace(p)} disabled={busy === p.id}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No places found</p>}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2 text-right">{filtered.length} of {places.length} places</p>
    </div>
  );
}
