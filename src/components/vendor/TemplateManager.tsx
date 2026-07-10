"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Area, Addon, ProposalStructure, estimateTotal, newArea } from "@/lib/estimate-pricing";

type Template = { id: string; name: string; description: string | null; structure: ProposalStructure };

function emptyStructure(): ProposalStructure {
  return {
    areas: [{ ...newArea(), name: "Main Area" }],
    addons: [],
    deposit_type: "percent", deposit_value: 50, payment_methods: ["card"],
    project_overview: null, notes: null,
  };
}

// Manage reusable proposal templates. Templates get their real content from the
// builder's "Save as template"; here you create/rename/duplicate/delete them.
export default function TemplateManager({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("estimate_templates").select("id, name, description, structure")
      .eq("vendor_id", vendorId).eq("is_active", true).order("name");
    setTemplates(((data as any[]) ?? []).map((t) => ({ ...t, structure: (t.structure ?? emptyStructure()) as ProposalStructure })));
    setLoading(false);
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    if (editing.id) {
      await supabase.from("estimate_templates").update({ name: editing.name.trim(), description: editing.description.trim() || null }).eq("id", editing.id);
      setTemplates((prev) => prev.map((t) => (t.id === editing.id ? { ...t, name: editing.name.trim(), description: editing.description.trim() || null } : t)));
    } else {
      const { data } = await supabase.from("estimate_templates").insert({
        vendor_id: vendorId, name: editing.name.trim(), description: editing.description.trim() || null, structure: emptyStructure(),
      }).select("id, name, description, structure").single();
      if (data) setTemplates((prev) => [...prev, { ...(data as any), structure: (data as any).structure as ProposalStructure }]);
    }
    setSaving(false);
    setEditing(null);
  }

  async function duplicate(t: Template) {
    const { data } = await supabase.from("estimate_templates").insert({
      vendor_id: vendorId, name: `${t.name} (copy)`, description: t.description, structure: t.structure,
    }).select("id, name, description, structure").single();
    if (data) setTemplates((prev) => [...prev, { ...(data as any), structure: (data as any).structure as ProposalStructure }]);
  }

  async function remove(id: string) {
    if (!confirm("Delete this template? Proposals already created from it are unaffected.")) return;
    await supabase.from("estimate_templates").update({ is_active: false }).eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4">
        <p className="text-sm text-gray-500 max-w-lg">
          Start a proposal from a template to skip the setup. Build a great proposal once, then use
          <strong> Save as template </strong> in the builder to capture it here.
        </p>
        <button onClick={() => setEditing({ name: "", description: "" })}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">+ New Template</button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-14 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🧱</p>
          <p className="font-semibold text-gray-600 mb-1">No templates yet</p>
          <p className="text-sm">Create one here, or save a finished proposal as a template.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const areas = (t.structure.areas ?? []) as Area[];
            const addons = (t.structure.addons ?? []) as Addon[];
            const total = estimateTotal(areas, addons);
            return (
              <div key={t.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{areas.length} area{areas.length === 1 ? "" : "s"} · {addons.length} add-on{addons.length === 1 ? "" : "s"} · ${total.toFixed(2)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing({ id: t.id, name: t.name, description: t.description ?? "" })} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Rename</button>
                  <button onClick={() => duplicate(t)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Duplicate</button>
                  <button onClick={() => remove(t.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing.id ? "Rename template" : "New template"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Template name</span>
                <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Exterior Repaint — Standard" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 block mb-1">Description (optional)</span>
                <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="When to use this template" className={inputCls} />
              </label>
              {!editing.id && <p className="text-xs text-gray-400">Starts with one empty area. Add the real content by opening a proposal from it, then <strong>Save as template</strong>.</p>}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={save} disabled={saving || !editing.name.trim()} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditing(null)} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";
