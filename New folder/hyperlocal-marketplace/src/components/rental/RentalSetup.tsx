"use client";

import { useState, useEffect } from "react";

type Duration = { id?: string; label: string; hours: string; price: string };
type SupabaseClient = any;

interface Props {
  listingId: string | null; // null when creating a new listing
  supabase: SupabaseClient;
  waiverUrl: string | null;
  waiverFilename: string | null;
  vendorId: string;
  onWaiverUploaded: (url: string, filename: string) => void;
  onDurationsChange: (durations: { label: string; hours: number; price: number }[]) => void;
}

export default function RentalSetup({ listingId, supabase, waiverUrl, waiverFilename, vendorId, onWaiverUploaded, onDurationsChange }: Props) {
  const [durations, setDurations] = useState<Duration[]>([
    { label: "1 Hour", hours: "1", price: "" },
  ]);
  const [uploadingWaiver, setUploadingWaiver] = useState(false);
  const [waiver, setWaiver] = useState<{ url: string | null; filename: string | null }>({ url: waiverUrl, filename: waiverFilename });

  // Load existing durations if editing
  useEffect(() => {
    if (!listingId) return;
    supabase.from("rental_durations").select("*").eq("listing_id", listingId).order("hours").then(({ data }: any) => {
      if (data?.length) {
        setDurations(data.map((d: any) => ({ id: d.id, label: d.label, hours: String(d.hours), price: String(d.price) })));
      }
    });
  }, [listingId]);

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

  return (
    <div className="space-y-5 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">🏠 Rental Settings</p>

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
        <p className="text-xs text-gray-400 mt-1">Example: "Half Day" · 4 hrs · $75.00</p>
      </div>

      {/* Waiver upload */}
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
      </div>
    </div>
  );
}
