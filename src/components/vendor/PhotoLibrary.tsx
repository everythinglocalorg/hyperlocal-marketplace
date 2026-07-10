"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; title: string | null; url: string };

// A reusable photo library — upload once, attach to any proposal from the builder.
export default function PhotoLibrary({ vendorId, userId }: { vendorId: string; userId: string }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("estimate_photos").select("id, title, url").eq("vendor_id", vendorId).eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => { setPhotos((data as Photo[]) ?? []); setLoading(false); });
  }, [vendorId, supabase]);

  async function addFiles(files: FileList) {
    setErr(null); setBusy(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { setErr("Only image files can be uploaded."); continue; }
      if (file.size > 10 * 1024 * 1024) { setErr("Each photo must be under 10MB."); continue; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/library/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
      if (error) { setErr(error.message); continue; }
      const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
      const { data: row } = await supabase.from("estimate_photos").insert({ vendor_id: vendorId, url: data.publicUrl, title: file.name.replace(/\.[^.]+$/, "") }).select("id, title, url").single();
      if (row) setPhotos((prev) => [row as Photo, ...prev]);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function updateTitle(id: string, title: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    await supabase.from("estimate_photos").update({ title }).eq("id", id);
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo from your library?")) return;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("estimate_photos").update({ is_active: false }).eq("id", id);
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-3 gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Photos</h3>
          <p className="text-xs text-gray-400 max-w-md">Save reusable photos (examples, license, insurance, crew) and attach them to any proposal.</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0 disabled:opacity-40">
          {busy ? "Uploading…" : "＋ Upload photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-gray-400 py-3">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img src={p.url} alt={p.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-2 flex items-center gap-1">
                <input value={p.title ?? ""} onChange={(e) => updateTitle(p.id, e.target.value)} placeholder="Caption"
                  className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500" />
                <button onClick={() => remove(p.id)} className="text-gray-300 hover:text-red-400 text-sm shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
