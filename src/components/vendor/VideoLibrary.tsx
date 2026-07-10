"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Video = { id: string; title: string; url: string; source: string };

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

function detectSource(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/loom\.com/.test(url)) return "loom";
  return "url";
}

// A reusable library of videos (intro, warranty explainer, etc.) that can be
// attached to any proposal from the builder in one click.
export default function VideoLibrary({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; title: string; url: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("estimate_videos").select("id, title, url, source")
      .eq("vendor_id", vendorId).eq("is_active", true).order("title");
    setVideos((data as Video[]) ?? []);
    setLoading(false);
  }

  async function save() {
    if (!editing || !editing.title.trim() || !editing.url.trim()) return;
    setSaving(true);
    const payload = { vendor_id: vendorId, title: editing.title.trim(), url: editing.url.trim(), source: detectSource(editing.url) };
    if (editing.id) {
      await supabase.from("estimate_videos").update({ title: payload.title, url: payload.url, source: payload.source }).eq("id", editing.id);
      setVideos((prev) => prev.map((v) => (v.id === editing.id ? { ...v, ...payload } : v)));
    } else {
      const { data } = await supabase.from("estimate_videos").insert(payload).select("id, title, url, source").single();
      if (data) setVideos((prev) => [...prev, data as Video]);
    }
    setSaving(false);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this video from your library?")) return;
    await supabase.from("estimate_videos").update({ is_active: false }).eq("id", id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4">
        <p className="text-sm text-gray-500 max-w-lg">Save videos once, then attach them to any proposal from the builder. YouTube, Vimeo, and Loom embed automatically.</p>
        <button onClick={() => setEditing({ title: "", url: "" })}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">+ Add Video</button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-14 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🎬</p>
          <p className="font-semibold text-gray-600 mb-1">No videos yet</p>
          <p className="text-sm">Add a company intro or warranty explainer to reuse everywhere.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {videos.map((v) => (
            <div key={v.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <span className="text-2xl shrink-0">🎬</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{v.title}</p>
                <a href={v.url} target="_blank" rel="noopener" className="text-xs text-green-700 hover:underline truncate block">{v.url}</a>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0 capitalize">{v.source}</span>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing({ id: v.id, title: v.title, url: v.url })} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                <button onClick={() => remove(v.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing.id ? "Edit video" : "Add video"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Title</span>
                <input autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. 60-second company intro" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Video link</span>
                <input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  placeholder="YouTube / Vimeo / Loom URL" className={inputCls} />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={save} disabled={saving || !editing.title.trim() || !editing.url.trim()} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
