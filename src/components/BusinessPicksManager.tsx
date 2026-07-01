"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export interface PickVendor {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  city: string;
  state: string;
  tier: string;
  is_verified: boolean;
  rating: number;
}

interface Props {
  userId: string;
  engagedVendors: PickVendor[];
  initialPicks: PickVendor[];
}

const MAX_PICKS = 8;

function VendorAvatar({ v, size = "w-11 h-11" }: { v: PickVendor; size?: string }) {
  return (
    <div className={`${size} rounded-xl flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden ${v.logo_url ? "bg-white border border-gray-100" : "bg-green-100"}`}>
      {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-contain" /> : v.business_name[0]?.toUpperCase()}
    </div>
  );
}

export default function BusinessPicksManager({ userId, engagedVendors, initialPicks }: Props) {
  const supabase = createClient();
  const [picks, setPicks] = useState<PickVendor[]>(initialPicks);
  const [savedPicks, setSavedPicks] = useState<PickVendor[]>(initialPicks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PickVendor[]>([]);
  const [searching, setSearching] = useState(false);

  // Live search across ALL local businesses (debounced).
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, business_name, slug, logo_url, category, city, state, tier, is_verified, rating")
        .eq("is_active", true)
        .or(`business_name.ilike.%${q}%,category.ilike.%${q}%,city.ilike.%${q}%`)
        .order("business_name")
        .limit(20);
      setSearchResults((data as PickVendor[]) ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, supabase]);

  const available = useMemo(() => {
    const pickedIds = new Set(picks.map((p) => p.id));
    // When searching, show matches from all businesses; otherwise suggest ones you've engaged with.
    const source = query.trim() ? searchResults : engagedVendors;
    return source.filter((v) => !pickedIds.has(v.id));
  }, [engagedVendors, searchResults, picks, query]);

  const dirty = useMemo(() => {
    if (picks.length !== savedPicks.length) return true;
    return picks.some((p, i) => p.id !== savedPicks[i]?.id);
  }, [picks, savedPicks]);

  function add(v: PickVendor) {
    if (picks.length >= MAX_PICKS) return;
    setPicks((prev) => [...prev, v]);
  }

  function remove(id: string) {
    setPicks((prev) => prev.filter((p) => p.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setPicks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);

    const { error: delError } = await supabase
      .from("profile_business_picks")
      .delete()
      .eq("user_id", userId);

    if (delError) {
      setError(delError.message);
      setSaving(false);
      return;
    }

    if (picks.length > 0) {
      const rows = picks.map((p, i) => ({ user_id: userId, vendor_id: p.id, position: i + 1 }));
      const { error: insError } = await supabase.from("profile_business_picks").insert(rows);
      if (insError) {
        setError(insError.message);
        setSaving(false);
        return;
      }
    }

    setSavedPicks(picks);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Selected picks */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Your Top {MAX_PICKS}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {picks.length}/{MAX_PICKS} chosen · drag-free ordering with the arrows
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            disabled={picks.length >= MAX_PICKS}
            className="shrink-0 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add business
          </button>
        </div>

        {/* Always show all 8 spots — filled rows have controls, open ones invite you to fill them */}
        <ol className="divide-y divide-gray-50">
          {Array.from({ length: MAX_PICKS }).map((_, i) => {
            const v = picks[i];
            const isTop = i === 0;

            if (!v) {
              return (
                <li key={`open-${i}`} className="flex items-center gap-3 px-6 py-3">
                  <span className="w-6 text-center text-sm font-bold text-gray-300 shrink-0">{isTop ? "👑" : i + 1}</span>
                  <div className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 shrink-0">＋</div>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex-1 text-left text-sm text-gray-400 hover:text-green-700 transition-colors"
                  >
                    {isTop ? "Open spot — add your #1 pick" : "Open spot — add a business"}
                  </button>
                </li>
              );
            }

            return (
              <li key={v.id} className="flex items-center gap-3 px-6 py-3">
                <span className="w-6 text-center text-sm font-bold text-gray-300 shrink-0">{isTop ? "👑" : i + 1}</span>
                <VendorAvatar v={v} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {v.business_name}
                    {v.is_verified && <span className="ml-1 text-blue-500" title="Verified">✓</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{v.category} · {v.city}, {v.state}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === picks.length - 1} aria-label="Move down"
                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">▼</button>
                  <button onClick={() => remove(v.id)} aria-label="Remove"
                    className="w-7 h-7 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Add-from-engaged picker */}
      {showAdd && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Find a business to feature</h3>
            <p className="text-xs text-gray-400 mt-0.5">Search any local business and add it to your Top 8.</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, category, or city…"
              autoFocus
              className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {!query.trim() && engagedVendors.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">Suggestions below are businesses you&rsquo;ve connected with — or search for any other.</p>
            )}
          </div>

          {searching ? (
            <div className="text-center py-10 text-gray-400 text-sm px-6">Searching…</div>
          ) : picks.length >= MAX_PICKS ? (
            <div className="text-center py-10 text-gray-400 text-sm px-6">You&rsquo;ve featured the maximum of {MAX_PICKS}. Remove one to add another.</div>
          ) : query.trim() && available.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm px-6">No businesses match &ldquo;{query.trim()}&rdquo;.</div>
          ) : !query.trim() && available.length === 0 ? (
            <div className="text-center py-10 px-6">
              <p className="text-3xl mb-2">🔎</p>
              <p className="text-gray-500 text-sm mb-1">Start typing to find a business.</p>
              <p className="text-gray-400 text-xs">Search any local business by name, category, or city.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {available.map((v) => (
                <button
                  key={v.id}
                  onClick={() => add(v)}
                  disabled={picks.length >= MAX_PICKS}
                  className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-green-50 transition-colors disabled:opacity-40"
                >
                  <VendorAvatar v={v} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.business_name}</p>
                    <p className="text-xs text-gray-400 truncate">{v.category} · {v.city}, {v.state}</p>
                  </div>
                  <span className="text-green-600 text-lg shrink-0">＋</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-gray-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : dirty ? "Save picks" : "Saved ✓"}
        </button>
        {dirty && !saving && <span className="text-xs text-amber-600">Unsaved changes</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
