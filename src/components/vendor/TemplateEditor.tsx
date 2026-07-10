"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProposalStructureEditor from "@/components/vendor/ProposalStructureEditor";
import { CatalogItem, Substrate, ProposalStructure, newArea, migrateOptionalAreas } from "@/lib/estimate-pricing";

type TemplateRow = { id: string; name: string; description: string | null; structure: ProposalStructure };
type Snippet = { id: string; kind: "snippet" | "note"; title: string; body: string };
type LibraryVideo = { id: string; title: string; url: string; source: string };

function normalize(s: ProposalStructure | undefined): ProposalStructure {
  return {
    areas: Array.isArray(s?.areas) && s!.areas.length ? migrateOptionalAreas(s!.areas) : [{ ...newArea(), name: "Main Area" }],
    addons: Array.isArray(s?.addons) ? s!.addons : [],
    deposit_type: s?.deposit_type ?? "percent",
    deposit_value: s?.deposit_value ?? 50,
    payment_methods: Array.isArray(s?.payment_methods) ? s!.payment_methods : ["card"],
    project_overview: s?.project_overview ?? null,
    notes: s?.notes ?? null,
    videos: Array.isArray(s?.videos) ? s!.videos : [],
  };
}

// Full editor for a template — the same body as the proposal builder (areas,
// pricing, add-ons, text & notes, deposit, payment) plus a reusable videos
// section. No customer/send: templates are just reusable content.
export default function TemplateEditor({ vendorId, template, onClose, onSaved }: {
  vendorId: string; template: TemplateRow; onClose: () => void; onSaved: (t: TemplateRow) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [structure, setStructure] = useState<ProposalStructure>(normalize(template.structure));
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [videoLibrary, setVideoLibrary] = useState<LibraryVideo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("estimate_catalog_items").select("*").eq("vendor_id", vendorId).eq("is_active", true).order("substrate").order("name")
      .then(({ data }) => setCatalog((data as CatalogItem[]) ?? []));
    supabase.from("estimate_substrates").select("*").eq("vendor_id", vendorId).eq("is_active", true).order("name")
      .then(({ data }) => setSubstrates((data as Substrate[]) ?? []));
    supabase.from("estimate_snippets").select("id, kind, title, body").eq("vendor_id", vendorId).eq("is_active", true).order("title")
      .then(({ data }) => setSnippets((data as any[]) ?? []));
    supabase.from("estimate_videos").select("id, title, url, source").eq("vendor_id", vendorId).eq("is_active", true).order("title")
      .then(({ data }) => setVideoLibrary((data as any[]) ?? []));
  }, [vendorId, supabase]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, structure };
    await supabase.from("estimate_templates").update(payload).eq("id", template.id);
    setSaving(false);
    onSaved({ id: template.id, ...payload });
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">← Templates</button>
        <h2 className="text-lg font-bold text-gray-900">Edit template</h2>
      </div>

      <div className="bg-gray-50 rounded-xl px-4 py-4 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 block mb-1">Template name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Exterior Repaint — Standard"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 block mb-1">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use this template"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </label>
      </div>

      <ProposalStructureEditor
        value={structure}
        onChange={setStructure}
        catalog={catalog}
        snippets={snippets}
        substrates={substrates}
        videoLibrary={videoLibrary}
        showVideos
        totalLabel="Template total"
      />

      <div className="flex gap-3 mt-6">
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
          {saving ? "Saving…" : "Save template"}
        </button>
        <button onClick={onClose} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}
