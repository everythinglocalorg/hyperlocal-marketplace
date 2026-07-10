"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Kind = "snippet" | "note";
type Snippet = { id: string; kind: Kind; title: string; body: string };

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

// Reusable text: 'snippet' = scope/verbiage for the project overview,
// 'note' = standard notes/terms. Both editable here; both insertable in builder.
export default function SnippetManager({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; kind: Kind; title: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("estimate_snippets").select("id, kind, title, body")
      .eq("vendor_id", vendorId).eq("is_active", true).order("title");
    setItems((data as Snippet[]) ?? []);
    setLoading(false);
  }

  async function save() {
    if (!editing || !editing.title.trim()) return;
    setSaving(true);
    const payload = { vendor_id: vendorId, kind: editing.kind, title: editing.title.trim(), body: editing.body };
    if (editing.id) {
      await supabase.from("estimate_snippets").update({ title: payload.title, body: payload.body, kind: payload.kind }).eq("id", editing.id);
      setItems((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...payload } : s)));
    } else {
      const { data } = await supabase.from("estimate_snippets").insert(payload).select("id, kind, title, body").single();
      if (data) setItems((prev) => [...prev, data as Snippet]);
    }
    setSaving(false);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this?")) return;
    await supabase.from("estimate_snippets").update({ is_active: false }).eq("id", id);
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  const sections: { kind: Kind; title: string; blurb: string }[] = [
    { kind: "snippet", title: "Text snippets", blurb: "Scope / highlight verbiage that drops into a proposal's project overview." },
    { kind: "note", title: "Notes & terms", blurb: "Standard notes and terms selectable per proposal." },
  ];

  return (
    <div className="space-y-8">
      {sections.map(({ kind, title, blurb }) => {
        const list = items.filter((s) => s.kind === kind);
        return (
          <div key={kind}>
            <div className="flex items-start justify-between mb-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                <p className="text-xs text-gray-400 max-w-md">{blurb}</p>
              </div>
              <button onClick={() => setEditing({ kind, title: "", body: "" })}
                className="text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors shrink-0">+ Add</button>
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">None yet.</p>
            ) : (
              <div className="space-y-2">
                {list.map((s) => (
                  <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 whitespace-pre-line">{s.body || "—"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditing({ id: s.id, kind: s.kind, title: s.title, body: s.body })} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                      <button onClick={() => remove(s.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing.id ? "Edit" : "New"} {editing.kind === "note" ? "note" : "snippet"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Title</span>
                <input autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={editing.kind === "note" ? "e.g. Standard payment terms" : "e.g. Surface prep — premium"} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Text</span>
                <textarea rows={6} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  placeholder="Markdown + links supported." className={`${inputCls} resize-none`} />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={save} disabled={saving || !editing.title.trim()} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
