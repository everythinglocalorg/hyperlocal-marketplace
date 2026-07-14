"use client";

import { useState, useEffect, useCallback } from "react";

type Duration = { id?: string; label: string; hours: string; price: string };
type SupabaseClient = any;

export type RentalSettings = {
  rental_mode: string;
  rental_buffer_hours: string;
  rental_quantity: string;
  waiver_body: string;
  fareharbor_shortname: string;
  fareharbor_flow: string;
};

interface Props {
  listingId: string | null; // null when creating a new listing
  supabase: SupabaseClient;
  waiverUrl: string | null;
  waiverFilename: string | null;
  vendorId: string;
  initialSettings?: Partial<RentalSettings>;
  onWaiverUploaded: (url: string, filename: string) => void;
  onDurationsChange: (durations: { label: string; hours: number; price: number }[]) => void;
  onSettingsChange: (settings: RentalSettings) => void;
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const DEFAULTS: RentalSettings = {
  rental_mode: "hourly",
  rental_buffer_hours: "0",
  rental_quantity: "1",
  waiver_body: "",
  fareharbor_shortname: "",
  fareharbor_flow: "",
};

export default function RentalSetup({ listingId, supabase, waiverUrl, waiverFilename, vendorId, initialSettings, onWaiverUploaded, onDurationsChange, onSettingsChange }: Props) {
  const [durations, setDurations] = useState<Duration[]>([
    { label: "1 Hour", hours: "1", price: "" },
  ]);
  const [uploadingWaiver, setUploadingWaiver] = useState(false);
  const [waiver, setWaiver] = useState<{ url: string | null; filename: string | null }>({ url: waiverUrl, filename: waiverFilename });
  const [settings, setSettings] = useState<RentalSettings>({ ...DEFAULTS, ...initialSettings });

  // Blackout dates
  const [blackouts, setBlackouts] = useState<string[]>([]);
  const today = new Date();
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Load existing durations if editing
  useEffect(() => {
    if (!listingId) return;
    supabase.from("rental_durations").select("*").eq("listing_id", listingId).order("hours").then(({ data }: any) => {
      if (data?.length) {
        setDurations(data.map((d: any) => ({ id: d.id, label: d.label, hours: String(d.hours), price: String(d.price) })));
      }
    });
  }, [listingId]);

  const loadBlackouts = useCallback(() => {
    if (!listingId) return;
    supabase.from("rental_blackouts").select("date").eq("listing_id", listingId).then(({ data }: any) => {
      if (data) setBlackouts(data.map((b: any) => b.date));
    });
  }, [listingId, supabase]);

  useEffect(() => { loadBlackouts(); }, [loadBlackouts]);

  function updateSettings(patch: Partial<RentalSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange(next);
  }

  function addDuration() {
    const updated = [...durations, { label: "", hours: "", price: "" }];
    setDurations(updated);
    notify(updated);
  }
  function removeDuration(i: number) {
    const updated = durations.filter((_, idx) => idx !== i);
    setDurations(updated);
    notify(updated);
  }
  function updateDuration(i: number, field: keyof Duration, value: string) {
    const updated = durations.map((d, idx) => idx === i ? { ...d, [field]: value } : d);
    setDurations(updated);
    notify(updated);
  }
  function notify(durs: Duration[]) {
    onDurationsChange(durs.filter((d) => d.label && d.hours && d.price).map((d) => ({
      label: d.label, hours: Number(d.hours), price: Number(d.price),
    })));
  }

  async function toggleBlackout(dateStr: string) {
    if (!listingId) return;
    if (blackouts.includes(dateStr)) {
      setBlackouts((b) => b.filter((d) => d !== dateStr));
      await supabase.from("rental_blackouts").delete().eq("listing_id", listingId).eq("date", dateStr);
    } else {
      setBlackouts((b) => [...b, dateStr]);
      await supabase.from("rental_blackouts").insert({ listing_id: listingId, vendor_id: vendorId, date: dateStr });
    }
  }

  async function uploadWaiver(file: File) {
    setUploadingWaiver(true);
    const ext = file.name.split(".").pop();
    const path = `${vendorId}/waivers/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("vendor-logos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("vendor-logos").getPublicUrl(path);
      setWaiver({ url: publicUrl, filename: file.name });
      onWaiverUploaded(publicUrl, file.name);
    }
    setUploadingWaiver(false);
  }

  function renderBlackoutCalendar() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const todayStr = fmt(today);
    const monthName = calMonth.toLocaleString("default", { month: "long", year: "numeric" });

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">◀</button>
          <span className="text-xs font-semibold text-gray-700">{monthName}</span>
          <button type="button" onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
            <div key={d} className="text-[10px] text-gray-400 font-medium py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isPast = dateStr < todayStr;
            const isBlocked = blackouts.includes(dateStr);
            return (
              <button key={i} type="button" disabled={isPast}
                onClick={() => toggleBlackout(dateStr)}
                className={`h-7 w-full rounded text-xs transition-colors ${
                  isBlocked ? "bg-red-500 text-white font-bold" :
                  isPast ? "text-gray-300 cursor-not-allowed" :
                  "hover:bg-red-50 text-gray-600"
                }`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">🏠 Rental Settings</p>

      {/* Booking mode */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Booking Type</label>
        <div className="flex gap-2">
          {[["hourly","By the hour"],["daily","By the day / multi-day"]].map(([val, lbl]) => (
            <button key={val} type="button" onClick={() => updateSettings({ rental_mode: val })}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                settings.rental_mode === val ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600"
              }`}>
              {lbl}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {settings.rental_mode === "daily" ? "Customers pick a start & end date; per-day durations multiply by days booked." : "Customers pick a day and a start time."}
        </p>
      </div>

      {/* Duration tiers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-500">Duration & Pricing</label>
          <button type="button" onClick={addDuration}
            className="text-xs text-green-700 font-semibold hover:underline">+ Add option</button>
        </div>
        <div className="space-y-2">
          {durations.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text" value={d.label} placeholder="Label (e.g. Half Day)"
                onChange={(e) => updateDuration(i, "label", e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" value={d.hours} placeholder="Hrs" min="0.5" step="0.5"
                onChange={(e) => updateDuration(i, "hours", e.target.value)}
                className="w-16 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="relative w-24">
                <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
                <input
                  type="number" value={d.price} placeholder="0.00" min="0" step="0.01"
                  onChange={(e) => updateDuration(i, "price", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {durations.length > 1 && (
                <button type="button" onClick={() => removeDuration(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">✕</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Example: &quot;Half Day&quot; · 4 hrs · $75.00 {settings.rental_mode === "daily" && "· use 24 hrs for a per-day rate"}</p>
      </div>

      {/* Quantity + buffer */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Units available</label>
          <input type="number" min="1" step="1" value={settings.rental_quantity}
            onChange={(e) => updateSettings({ rental_quantity: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <p className="text-[11px] text-gray-400 mt-1">How many identical units you rent.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Turnaround (hours)</label>
          <input type="number" min="0" step="1" value={settings.rental_buffer_hours}
            onChange={(e) => updateSettings({ rental_buffer_hours: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <p className="text-[11px] text-gray-400 mt-1">Auto-blocked after each booking.</p>
        </div>
      </div>

      {/* Blackout dates */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Blackout Dates {blackouts.length > 0 && <span className="text-gray-400">({blackouts.length} blocked)</span>}</label>
        {listingId ? (
          <div className="border border-gray-200 rounded-xl p-3">
            {renderBlackoutCalendar()}
            <p className="text-[11px] text-gray-400 mt-2">Tap a day to block/unblock it. Blocked days show as unavailable to customers.</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Save the listing first, then reopen it to block specific dates.</p>
        )}
      </div>

      {/* Waiver upload + text */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Waiver / Agreement Document (PDF or image)</label>
        {waiver.url ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <span className="text-2xl">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 truncate">{waiver.filename}</p>
              <a href={waiver.url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">View document</a>
            </div>
            <label className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer font-medium">
              Replace
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files?.[0] && uploadWaiver(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <label className={`flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            uploadingWaiver ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50"
          }`}>
            <span className="text-2xl">{uploadingWaiver ? "⏳" : "📄"}</span>
            <span className="text-sm text-gray-500">{uploadingWaiver ? "Uploading..." : "Upload waiver or agreement"}</span>
            <span className="text-xs text-gray-400">PDF, JPG, or PNG</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingWaiver}
              onChange={(e) => e.target.files?.[0] && uploadWaiver(e.target.files[0])} />
          </label>
        )}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">…or paste waiver text</label>
          <textarea rows={3} value={settings.waiver_body} placeholder="Type the waiver / liability terms customers must sign."
            onChange={(e) => updateSettings({ waiver_body: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
      </div>

      {/* FareHarbor (optional) */}
      <details className="border border-gray-100 rounded-xl p-3">
        <summary className="text-xs font-medium text-gray-500 cursor-pointer">Use FareHarbor instead? (optional)</summary>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-gray-400">If you book through FareHarbor, enter your shortname to route &quot;Rent Now&quot; to their booking widget. FareHarbor then handles the calendar, payment, and waivers — the native flow above is skipped.</p>
          <input type="text" value={settings.fareharbor_shortname} placeholder="FareHarbor shortname"
            onChange={(e) => updateSettings({ fareharbor_shortname: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="text" value={settings.fareharbor_flow} placeholder="Flow / item ID (optional)"
            onChange={(e) => updateSettings({ fareharbor_flow: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </details>
    </div>
  );
}
