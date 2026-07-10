"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Area } from "@/lib/estimate-pricing";

type MediaRow = {
  id: string; area_id: string | null; kind: "photo" | "video"; source: string;
  url: string; thumb_url: string | null; caption: string | null; position: number;
};

// Detect a video host so the customer view can embed it; anything else is stored
// as a generic "url" video (rendered as a link).
function videoSource(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/loom\.com/.test(url)) return "loom";
  return "url";
}

interface Props {
  vendorId: string;
  userId: string;
  estimateId: string;               // "" until the proposal is saved
  areas: Area[];
  ensureSaved: () => Promise<string | null>;
}

export default function ProposalMedia({ vendorId, userId, estimateId, areas, ensureSaved }: Props) {
  const supabase = createClient();
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ id: string; title: string; url: string; source: string }[]>([]);
  const [photoLib, setPhotoLib] = useState<{ id: string; title: string | null; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!estimateId) { setMedia([]); return; }
    setLoading(true);
    supabase.from("estimate_media").select("*").eq("estimate_id", estimateId).order("position")
      .then(({ data }) => { setMedia((data as MediaRow[]) ?? []); setLoading(false); });
  }, [estimateId, supabase]);

  useEffect(() => {
    supabase.from("estimate_videos").select("id, title, url, source").eq("vendor_id", vendorId).eq("is_active", true).order("title")
      .then(({ data }) => setLibrary((data as any[]) ?? []));
    supabase.from("estimate_photos").select("id, title, url").eq("vendor_id", vendorId).eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => setPhotoLib((data as any[]) ?? []));
  }, [vendorId, supabase]);

  async function addFromLibrary(v: { title: string; url: string; source: string }) {
    setErr(null); setBusy(true);
    const id = await ensureSaved();
    if (!id) { setBusy(false); setErr("Save the proposal first."); return; }
    await insertRow({ area_id: null, kind: "video", source: v.source || videoSource(v.url), url: v.url, thumb_url: null, caption: v.title, position: media.length }, id);
    setBusy(false);
  }

  async function addPhotoFromLibrary(p: { title: string | null; url: string }) {
    setErr(null); setBusy(true);
    const id = await ensureSaved();
    if (!id) { setBusy(false); setErr("Save the proposal first."); return; }
    await insertRow({ area_id: null, kind: "photo", source: "url", url: p.url, thumb_url: null, caption: p.title ?? null, position: media.length }, id);
    setBusy(false);
  }

  async function insertRow(row: Omit<MediaRow, "id">, id: string) {
    const { data } = await supabase.from("estimate_media").insert({
      estimate_id: id, vendor_id: vendorId, ...row,
    }).select("*").single();
    if (data) setMedia((prev) => [...prev, data as MediaRow]);
  }

  async function addVideo() {
    setErr(null);
    const url = videoUrl.trim();
    if (!url) return;
    setBusy(true);
    const id = await ensureSaved();
    if (!id) { setBusy(false); setErr("Save the proposal first."); return; }
    await insertRow({ area_id: null, kind: "video", source: videoSource(url), url, thumb_url: null, caption: null, position: media.length }, id);
    setVideoUrl("");
    setBusy(false);
  }

  async function addPhotos(files: FileList) {
    setErr(null);
    setBusy(true);
    const id = await ensureSaved();
    if (!id) { setBusy(false); setErr("Save the proposal first."); return; }
    let pos = media.length;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { setErr("Only image files can be uploaded."); continue; }
      if (file.size > 10 * 1024 * 1024) { setErr("Each photo must be under 10MB."); continue; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/proposals/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
      if (error) { setErr(error.message); continue; }
      const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
      await insertRow({ area_id: null, kind: "photo", source: "upload", url: data.publicUrl, thumb_url: null, caption: null, position: pos++ }, id);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function updateRow(rowId: string, patch: Partial<MediaRow>) {
    setMedia((prev) => prev.map((m) => (m.id === rowId ? { ...m, ...patch } : m)));
    await supabase.from("estimate_media").update(patch).eq("id", rowId);
  }

  async function removeRow(rowId: string) {
    setMedia((prev) => prev.filter((m) => m.id !== rowId));
    await supabase.from("estimate_media").delete().eq("id", rowId);
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos & Videos</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="text-sm text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
          {busy ? "Working…" : "📷 Upload photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); }} />
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addVideo(); }}
            placeholder="Paste a YouTube / Vimeo / Loom link"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="button" onClick={addVideo} disabled={busy || !videoUrl.trim()}
            className="text-sm text-green-700 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-40">Add video</button>
        </div>
        {photoLib.length > 0 && (
          <select value="" disabled={busy} onChange={(e) => { const p = photoLib.find((x) => x.id === e.target.value); if (p) addPhotoFromLibrary(p); }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40">
            <option value="">📷 Attach photo from library…</option>
            {photoLib.map((p) => <option key={p.id} value={p.id}>{p.title || "Photo"}</option>)}
          </select>
        )}
        {library.length > 0 && (
          <select value="" disabled={busy} onChange={(e) => { const v = library.find((x) => x.id === e.target.value); if (v) addFromLibrary(v); }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40">
            <option value="">🎬 Attach video from library…</option>
            {library.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        )}
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">Loading media…</p>
      ) : media.length === 0 ? (
        <p className="text-xs text-gray-400">Add job photos or a walkthrough video — they show on the customer proposal. CompanyCam import arrives later.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => (
            <div key={m.id} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
              <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                {m.kind === "photo"
                  ? <img src={m.url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-3xl">🎬</span>}
              </div>
              <div className="p-2 space-y-1.5">
                <input value={m.caption ?? ""} onChange={(e) => updateRow(m.id, { caption: e.target.value })}
                  placeholder="Caption" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500" />
                <div className="flex items-center gap-1">
                  <select value={m.area_id ?? ""} onChange={(e) => updateRow(m.id, { area_id: e.target.value || null })}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-500">
                    <option value="">General</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button onClick={() => removeRow(m.id)} className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
