"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";

type Vendor = { id: string; business_name: string; tier: string; city: string; state: string; slug: string };
type Stop = {
  id?: string; day: number; position: number;
  start_time: string | null; duration_min: number | null;
  title: string; notes: string | null;
  ref_type: "vendor" | "listing" | "place" | "custom"; ref_id: string | null;
  custom_address: string | null; custom_lat: number | null; custom_lng: number | null;
};
type Experience = {
  id: string; title: string; price: number | null; description: string | null; images: string[] | null;
  is_active: boolean;
  meta?: { is_published: boolean; theme: string[]; duration_label: string | null; best_for: string | null } | null;
  stopCount?: number;
};

const THEMES = ["Foodie", "Romantic", "Family", "Outdoors", "Nightlife", "Arts", "Adventure", "Relaxation"];
const DURATIONS = ["Half day", "Full day", "Weekend", "Multi-day"];

export default function ExperiencesClient({ vendors, paidVendorIds }: { vendors: Vendor[]; paidVendorIds: string[] }) {
  const supabase = createClient();
  const paidVendors = vendors.filter((v) => paidVendorIds.includes(v.id));
  const [vendorId, setVendorId] = useState<string>(paidVendors[0]?.id ?? "");
  const [list, setList] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // listing id being edited

  const loadList = useCallback(async (vid: string) => {
    if (!vid) { setList([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("listings")
      .select("id, title, price, description, images, is_active, experience_meta(is_published, theme, duration_label, best_for), experience_stops(count)")
      .eq("vendor_id", vid)
      .eq("type", "experience")
      .order("created_at", { ascending: false });
    setList((data ?? []).map((r: any) => ({
      ...r,
      meta: Array.isArray(r.experience_meta) ? r.experience_meta[0] : r.experience_meta,
      stopCount: r.experience_stops?.[0]?.count ?? 0,
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadList(vendorId); }, [vendorId, loadList]);

  async function createExperience() {
    if (!vendorId) return;
    const { data, error } = await supabase.from("listings").insert({
      vendor_id: vendorId, title: "Untitled Experience", type: "experience", cta_type: "book",
      category: "Experiences", is_active: false,
    }).select("id").single();
    if (error || !data) { alert("Couldn't create: " + (error?.message ?? "")); return; }
    await supabase.from("experience_meta").insert({ listing_id: data.id });
    setEditing(data.id);
  }

  // ── No eligible business → upsell ──────────────────────────────────────
  if (paidVendors.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Become a Local Guide</h1>
          <p className="text-gray-500 mb-6">
            Curate and sell local itineraries — a foodie weekend, a date-night crawl, a family day out.
            Only businesses on a paid membership can publish Experiences.
          </p>
          <Link href="/dashboard/vendor/upgrade" className="inline-block bg-green-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-green-700 transition-colors">
            Upgrade to a paid plan →
          </Link>
        </div>
      </main>
    );
  }

  if (editing) {
    return <ExperienceEditor listingId={editing} onBack={() => { setEditing(null); loadList(vendorId); }} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">🗺️ Local Experiences</h1>
            <p className="text-sm text-gray-500 mt-0.5">Curate itineraries and sell them as bookable experiences.</p>
          </div>
          <button onClick={createExperience} className="self-end sm:self-auto bg-green-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors whitespace-nowrap">
            + New Experience
          </button>
        </div>

        {paidVendors.length > 1 && (
          <div className="mb-4 inline-flex items-center gap-2">
            <span className="text-xs text-gray-400">Business:</span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              {paidVendors.map((v) => <option key={v.id} value={v.id}>{v.business_name}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">🧭</p>
            <p className="text-gray-500">No experiences yet. Build your first curated itinerary.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((e) => (
              <button key={e.id} onClick={() => setEditing(e.id)} className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {e.images?.[0] ? <img src={e.images[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🗺️</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{e.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{e.stopCount} stop{e.stopCount === 1 ? "" : "s"}{e.price ? ` · ${formatPrice(e.price)}` : " · Free"}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${e.meta?.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {e.meta?.is_published ? "Published" : "Draft"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Editor ─────────────────────────────────────────────────────────────── */
function ExperienceEditor({ listingId, onBack }: { listingId: string; onBack: () => void }) {
  const supabase = createClient();
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [summary, setSummary] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [theme, setTheme] = useState<string[]>([]);
  const [duration, setDuration] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: l } = await supabase.from("listings").select("title, price, description, images").eq("id", listingId).single();
      const { data: m } = await supabase.from("experience_meta").select("theme, duration_label, best_for").eq("listing_id", listingId).maybeSingle();
      const { data: s } = await supabase.from("experience_stops").select("*").eq("listing_id", listingId).order("day").order("position");
      if (l) { setTitle(l.title === "Untitled Experience" ? "" : l.title); setPrice(l.price?.toString() ?? ""); setSummary(l.description ?? ""); setImages(l.images ?? []); }
      if (m) { setTheme(m.theme ?? []); setDuration(m.duration_label ?? ""); setBestFor(m.best_for ?? ""); }
      setStops((s ?? []) as Stop[]);
      setLoaded(true);
    })();
  }, [supabase, listingId]);

  const days = Array.from(new Set(stops.map((s) => s.day))).sort((a, b) => a - b);
  const maxDay = days.length ? Math.max(...days) : 1;

  function addStop(stop: Omit<Stop, "day" | "position">, day: number) {
    setStops((prev) => {
      const pos = prev.filter((s) => s.day === day).length;
      return [...prev, { ...stop, day, position: pos }];
    });
  }
  function updateStop(i: number, patch: Partial<Stop>) {
    setStops((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function removeStop(i: number) { setStops((prev) => prev.filter((_, idx) => idx !== i)); }
  function moveStop(i: number, dir: -1 | 1) {
    setStops((prev) => {
      const s = prev[i]; const sameDay = prev.map((x, idx) => ({ x, idx })).filter((o) => o.x.day === s.day);
      const localIdx = sameDay.findIndex((o) => o.idx === i);
      const swap = sameDay[localIdx + dir]; if (!swap) return prev;
      const next = [...prev]; [next[i], next[swap.idx]] = [next[swap.idx], next[i]]; return next;
    });
  }

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const path = `experiences/${listingId}-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("listing-images").upload(path, f, { upsert: true });
    if (!error) { const url = supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl; setImages([url]); }
    setUploading(false);
    e.target.value = "";
  }

  async function save() {
    setSaving(true);
    await supabase.from("listings").update({
      title: title.trim() || "Untitled Experience",
      price: price ? Number(price) : null,
      description: summary.trim() || null,
      images,
    }).eq("id", listingId);
    await supabase.from("experience_meta").upsert({
      listing_id: listingId, theme, duration_label: duration || null, best_for: bestFor.trim() || null, updated_at: new Date().toISOString(),
    });
    // Replace stops (simplest reliable sync for a small list).
    await supabase.from("experience_stops").delete().eq("listing_id", listingId);
    if (stops.length) {
      await supabase.from("experience_stops").insert(stops.map((s) => ({
        listing_id: listingId, day: s.day, position: s.position, start_time: s.start_time || null,
        duration_min: s.duration_min, title: s.title, notes: s.notes || null, ref_type: s.ref_type, ref_id: s.ref_id,
        custom_address: s.custom_address || null, custom_lat: s.custom_lat, custom_lng: s.custom_lng,
      })));
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  if (!loaded) return <main className="min-h-screen bg-gray-50"><div className="max-w-3xl mx-auto px-4 py-10"><div className="h-64 bg-white rounded-2xl animate-pulse" /></div></main>;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 mb-4">← All experiences</button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A Perfect Foodie Weekend in…" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Booking price ($) <span className="font-normal text-gray-400">— blank = free</span></label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Duration</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">—</option>
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cover photo</label>
            <div className="flex items-center gap-3">
              <div className="w-24 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {images[0] ? <img src={images[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🗺️</span>}
              </div>
              <label className="text-sm text-green-600 font-medium hover:underline cursor-pointer">
                {uploading ? "Uploading…" : images[0] ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Summary</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="What makes this itinerary special…" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Themes</label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button key={t} type="button" onClick={() => setTheme((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${theme.includes(t) ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Best for</label>
            <input value={bestFor} onChange={(e) => setBestFor(e.target.value)} placeholder="Couples · foodies · a rainy Saturday" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        {/* Itinerary */}
        <div className="mt-5 space-y-4">
          {(days.length ? days : [1]).map((day) => (
            <DayBlock key={day} day={day} stops={stops} onMove={moveStop} onUpdate={updateStop} onRemove={removeStop} onAdd={(s) => addStop(s, day)} />
          ))}
          <button onClick={() => addStop({ title: "New stop", notes: null, start_time: null, duration_min: null, ref_type: "custom", ref_id: null, custom_address: null, custom_lat: null, custom_lng: null }, maxDay + 1)}
            className="text-sm font-semibold text-green-700 border border-green-300 border-dashed rounded-xl px-4 py-2.5 hover:bg-green-50 transition-colors w-full">
            + Add a day
          </button>
        </div>

        <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-3 bg-gray-50/95 backdrop-blur border-t border-gray-200 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save draft"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
          <span className="ml-auto text-xs text-gray-400">Publishing (with the $50 release fee) comes next.</span>
        </div>
      </div>
    </main>
  );
}

/* ── One day of stops + add-stop picker ─────────────────────────────────── */
function DayBlock({ day, stops, onMove, onUpdate, onRemove, onAdd }: {
  day: number; stops: Stop[];
  onMove: (i: number, dir: -1 | 1) => void; onUpdate: (i: number, patch: Partial<Stop>) => void;
  onRemove: (i: number) => void; onAdd: (s: Omit<Stop, "day" | "position">) => void;
}) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const dayStops = stops.map((s, i) => ({ s, i })).filter((o) => o.s.day === day);

  useEffect(() => {
    const term = q.trim(); if (term.length < 2) { setResults([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from("vendors").select("id, business_name, city, state, latitude, longitude").ilike("business_name", `%${term}%`).eq("is_active", true).limit(5),
        supabase.from("places").select("id, name, city, state, latitude, longitude").ilike("name", `%${term}%`).eq("is_active", true).limit(5),
      ]);
      if (cancel) return;
      setResults([
        ...(v ?? []).map((x: any) => ({ kind: "vendor", id: x.id, name: x.business_name, sub: `${x.city}, ${x.state}`, lat: x.latitude, lng: x.longitude })),
        ...(p ?? []).map((x: any) => ({ kind: "place", id: x.id, name: x.name, sub: `${x.city}, ${x.state}`, lat: x.latitude, lng: x.longitude })),
      ]);
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, supabase]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-3">Day {day}</p>
      <div className="space-y-2 mb-3">
        {dayStops.length === 0 && <p className="text-sm text-gray-400">No stops yet — add restaurants, spots, or a custom stop.</p>}
        {dayStops.map(({ s, i }, localIdx) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col text-gray-300">
                <button onClick={() => onMove(i, -1)} disabled={localIdx === 0} className="hover:text-gray-600 disabled:opacity-30 leading-none text-xs">▲</button>
                <button onClick={() => onMove(i, 1)} disabled={localIdx === dayStops.length - 1} className="hover:text-gray-600 disabled:opacity-30 leading-none text-xs">▼</button>
              </div>
              <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{localIdx + 1}</span>
              <div className="flex-1 min-w-0">
                <input value={s.title} onChange={(e) => onUpdate(i, { title: e.target.value })} className="w-full font-semibold text-sm text-gray-900 border-0 border-b border-transparent focus:border-gray-200 focus:outline-none px-0 py-0.5" />
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="time" value={s.start_time ?? ""} onChange={(e) => onUpdate(i, { start_time: e.target.value || null })} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600" />
                  {s.ref_type !== "custom" && <span className="text-[10px] uppercase font-bold text-gray-400">{s.ref_type}</span>}
                </div>
                <textarea value={s.notes ?? ""} onChange={(e) => onUpdate(i, { notes: e.target.value })} rows={1} placeholder="Your tip for this stop…" className="w-full text-xs text-gray-600 border border-gray-100 rounded-lg px-2 py-1 mt-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <button onClick={() => onRemove(i)} className="text-gray-300 hover:text-red-500 text-sm shrink-0">×</button>
            </div>
          </div>
        ))}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Search a business or place to add…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      {results.length > 0 && (
        <div className="mt-1 border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
          {results.map((r) => (
            <button key={`${r.kind}-${r.id}`} onClick={() => { onAdd({ title: r.name, notes: null, start_time: null, duration_min: null, ref_type: r.kind, ref_id: r.id, custom_address: null, custom_lat: r.lat, custom_lng: r.lng }); setQ(""); setResults([]); }}
              className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm flex items-center justify-between gap-2">
              <span className="truncate"><span className="font-medium text-gray-800">{r.name}</span> <span className="text-gray-400 text-xs">{r.sub}</span></span>
              <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => onAdd({ title: "Custom stop", notes: null, start_time: null, duration_min: null, ref_type: "custom", ref_id: null, custom_address: null, custom_lat: null, custom_lng: null })}
        className="mt-2 text-xs text-gray-500 hover:text-green-700">+ Add a custom stop</button>
    </div>
  );
}
