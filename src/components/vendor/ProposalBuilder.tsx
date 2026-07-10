"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ProposalMedia from "@/components/vendor/ProposalMedia";
import ProposalStructureEditor from "@/components/vendor/ProposalStructureEditor";
import {
  CatalogItem, Area, Addon, ProposalLine, DepositType, PaymentMethod, ProposalStructure,
  estimateTotal, toFlatLineItems, newArea, newBlankLine, round2, cloneStructureWithNewIds, migrateOptionalAreas,
} from "@/lib/estimate-pricing";

type TemplateLite = { id: string; name: string; description: string | null; structure: ProposalStructure };

type Contact = { id: string; name: string; email: string | null; phone: string | null; address?: string | null };
type FlatLine = { id: string; description: string; qty: number; unit_price: number };

type Estimate = {
  id: string; title: string; status: string;
  line_items: FlatLine[];
  areas: Area[]; addons: Addon[];
  deposit_type: DepositType; deposit_value: number; payment_methods: PaymentMethod[];
  project_overview: string | null; notes: string | null;
  contact_id: string | null; created_at: string;
  share_token?: string | null; accepted_at?: string | null; deposit_paid_at?: string | null;
  contact?: Contact | null;
  customer_name?: string | null; customer_email?: string | null;
  customer_phone?: string | null; customer_address?: string | null;
};

interface Props { vendorId: string; userId: string; defaultContact?: Contact | null; onBack: () => void; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

// A legacy estimate has flat line_items but no areas — wrap them into one area
// of manual-total lines so it opens cleanly in the builder.
function normalizeAreas(raw: any): Area[] {
  const areas: Area[] = Array.isArray(raw.areas) ? raw.areas : [];
  if (areas.length > 0) return areas;
  const flat: FlatLine[] = Array.isArray(raw.line_items) ? raw.line_items : [];
  if (flat.length === 0) return [];
  const lines: ProposalLine[] = flat.map((li) => ({
    ...newBlankLine(),
    id: li.id ?? crypto.randomUUID(),
    name: li.description || "Item",
    manual_total: round2((Number(li.qty) || 1) * (Number(li.unit_price) || 0)),
  }));
  return [{ ...newArea(), name: "Estimate", lines }];
}

export default function ProposalBuilder({ vendorId, userId, defaultContact, onBack }: Props) {
  const supabase = createClient();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [picking, setPicking] = useState<{ contact: Contact | null } | null>(null);

  useEffect(() => { loadEstimates(); loadTemplates(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);
  useEffect(() => { if (defaultContact) startNew(defaultContact); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [defaultContact]);

  // No templates → skip the picker and open a blank proposal.
  function startNew(contact?: Contact | null) {
    if (templates.length === 0) openNew(contact ?? null, null);
    else setPicking({ contact: contact ?? null });
  }

  async function loadTemplates() {
    const { data } = await supabase.from("estimate_templates")
      .select("id, name, description, structure")
      .eq("vendor_id", vendorId).eq("is_active", true).order("name");
    setTemplates(((data as any[]) ?? []).map((t) => ({ ...t, structure: (t.structure ?? {}) as ProposalStructure })));
  }

  async function loadEstimates() {
    const { data } = await supabase
      .from("estimates")
      .select("*, contact:crm_contacts(id, name, email, phone)")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    setEstimates((data ?? []).map((e: any) => ({
      ...e,
      line_items: e.line_items ?? [],
      areas: migrateOptionalAreas(normalizeAreas(e)),
      addons: Array.isArray(e.addons) ? e.addons : [],
      deposit_type: (e.deposit_type as DepositType) ?? "percent",
      deposit_value: e.deposit_value ?? 50,
      payment_methods: Array.isArray(e.payment_methods) ? e.payment_methods : ["card"],
      share_token: e.share_token ?? null,
      accepted_at: e.accepted_at ?? null,
      deposit_paid_at: e.deposit_paid_at ?? null,
      contact: Array.isArray(e.contact) ? e.contact[0] : e.contact,
    })));
    setLoading(false);
  }

  async function openNew(contact?: Contact | null, template?: TemplateLite | null) {
    setPicking(null);
    const s = template?.structure && Array.isArray(template.structure.areas)
      ? cloneStructureWithNewIds({
          areas: template.structure.areas ?? [],
          addons: template.structure.addons ?? [],
          deposit_type: template.structure.deposit_type ?? "percent",
          deposit_value: template.structure.deposit_value ?? 50,
          payment_methods: template.structure.payment_methods ?? ["card"],
          project_overview: template.structure.project_overview ?? null,
          notes: template.structure.notes ?? null,
        })
      : null;
    const draft: Estimate = {
      id: "", title: template ? template.name : "New Proposal", status: "draft",
      line_items: [],
      areas: s && s.areas.length ? migrateOptionalAreas(s.areas) : [{ ...newArea(), name: "Main Area" }],
      addons: s?.addons ?? [],
      deposit_type: s?.deposit_type ?? "percent", deposit_value: s?.deposit_value ?? 50,
      payment_methods: s?.payment_methods ?? ["card"],
      project_overview: s?.project_overview ?? null, notes: s?.notes ?? null,
      share_token: null, accepted_at: null, deposit_paid_at: null,
      contact_id: contact?.id ?? null, created_at: new Date().toISOString(), contact: contact ?? null,
      customer_name: contact?.name ?? "", customer_email: contact?.email ?? "",
      customer_phone: contact?.phone ?? "", customer_address: contact?.address ?? "",
    };

    // A template can carry videos — persist the proposal now and copy them in as
    // media so they show on the builder and customer view.
    const vids = template?.structure?.videos ?? [];
    if (vids.length) {
      const id = await saveEstimate(draft);
      if (id) {
        await supabase.from("estimate_media").insert(vids.map((v, i) => ({
          estimate_id: id, vendor_id: vendorId, area_id: null, kind: "video",
          source: v.source || "url", url: v.url, caption: v.title, position: i,
        })));
        setEditing({ ...draft, id });
        return;
      }
    }
    setEditing(draft);
  }

  async function saveEstimate(est: Estimate): Promise<string | null> {
    const payload = {
      vendor_id: vendorId, title: est.title, status: est.status,
      areas: est.areas, addons: est.addons,
      line_items: toFlatLineItems(est.areas, est.addons),
      deposit_type: est.deposit_type, deposit_value: est.deposit_value, payment_methods: est.payment_methods,
      project_overview: est.project_overview, notes: est.notes, contact_id: est.contact_id,
      customer_name: est.customer_name?.trim() || null,
      customer_email: est.customer_email?.trim() || null,
      customer_phone: est.customer_phone?.trim() || null,
      customer_address: est.customer_address?.trim() || null,
    };
    if (est.id) {
      await supabase.from("estimates").update(payload).eq("id", est.id);
      setEstimates((prev) => prev.map((e) => (e.id === est.id ? { ...est } : e)));
      return est.id;
    }
    const { data } = await supabase.from("estimates").insert(payload).select("id").single();
    if (data) { setEstimates((prev) => [{ ...est, id: data.id }, ...prev]); return data.id; }
    return null;
  }

  async function deleteEstimate(id: string) {
    if (!confirm("Delete this proposal?")) return;
    await supabase.from("estimates").delete().eq("id", id);
    setEstimates((prev) => prev.filter((e) => e.id !== id));
  }

  if (editing) return (
    <ProposalEditor estimate={editing} vendorId={vendorId} userId={userId} onSave={saveEstimate} onClose={() => setEditing(null)} />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">← Back to CRM</button>
          <h2 className="text-lg font-bold text-gray-900">Estimates & Proposals</h2>
        </div>
        <button onClick={() => startNew(defaultContact)}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
          + New Proposal
        </button>
      </div>

      {picking && (
        <TemplatePicker
          templates={templates}
          onPick={(t) => openNew(picking.contact, t)}
          onClose={() => setPicking(null)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : estimates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-600 mb-1">No proposals yet</p>
          <p className="text-sm">Build a professional, itemized proposal in a couple minutes.</p>
          <button onClick={() => startNew()} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">Create Proposal</button>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((est) => {
            const total = estimateTotal(est.areas, est.addons);
            return (
              <div key={est.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 truncate">{est.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[est.status] ?? STATUS_COLORS.draft}`}>{est.status}</span>
                  </div>
                  {(est.customer_name ?? est.contact?.name) && <p className="text-xs text-gray-400">{est.customer_name ?? est.contact?.name}</p>}
                  <p className="text-xs text-gray-400">{new Date(est.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-lg font-bold text-green-700 shrink-0">${total.toFixed(2)}</p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(est)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Open</button>
                  <button onClick={() => deleteEstimate(est.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProposalEditor({ estimate, vendorId, userId, onSave, onClose }: {
  estimate: Estimate; vendorId: string; userId: string;
  onSave: (e: Estimate) => Promise<string | null>; onClose: () => void;
}) {
  const supabase = createClient();
  const [est, setEst] = useState<Estimate>({
    ...estimate,
    areas: estimate.areas.map((a) => ({ ...a, lines: a.lines.map((l) => ({ ...l })) })),
    addons: estimate.addons.map((a) => ({ ...a })),
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [snippets, setSnippets] = useState<{ id: string; kind: "snippet" | "note"; title: string; body: string }[]>([]);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [sending, setSending] = useState<null | "email" | "internal">(null);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingClose, setSavingClose] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ensure the proposal is saved and has a public share token; returns the token.
  async function ensureShareLink(): Promise<string | null> {
    setLinkBusy(true);
    try {
      const id = await onSave(est);
      if (!id) return null;
      let token = est.share_token ?? null;
      if (!token) {
        token = crypto.randomUUID().replace(/-/g, "");
        await supabase.from("estimates").update({ share_token: token }).eq("id", id);
        setEst((prev) => ({ ...prev, id, share_token: token }));
      }
      return token;
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyCustomerLink() {
    const token = await ensureShareLink();
    if (!token) { setSendMsg({ ok: false, text: "Could not create the link." }); return; }
    const url = `${window.location.origin}/proposal/${token}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy this proposal link:", url); }
  }

  async function openCustomerView() {
    const token = await ensureShareLink();
    if (token) window.open(`/proposal/${token}`, "_blank");
  }

  useEffect(() => {
    supabase.from("crm_contacts").select("id, name, email, phone, address").eq("vendor_id", vendorId).order("name")
      .then(({ data }) => setContacts((data as Contact[]) ?? []));
    supabase.from("estimate_catalog_items").select("*").eq("vendor_id", vendorId).eq("is_active", true).order("substrate").order("name")
      .then(({ data }) => setCatalog((data as CatalogItem[]) ?? []));
    supabase.from("estimate_snippets").select("id, kind, title, body").eq("vendor_id", vendorId).eq("is_active", true).order("title")
      .then(({ data }) => setSnippets((data as any[]) ?? []));
  }, [vendorId, supabase]);

  async function saveAsTemplate() {
    const name = window.prompt("Save this proposal as a reusable template.\nTemplate name:", est.title);
    if (!name?.trim()) return;
    // Carry any attached videos into the template so they come back on reuse.
    let videos: { id: string; title: string; url: string; source: string }[] = [];
    if (est.id) {
      const { data } = await supabase.from("estimate_media").select("url, caption, source").eq("estimate_id", est.id).eq("kind", "video");
      videos = ((data as any[]) ?? []).map((m) => ({ id: crypto.randomUUID(), title: m.caption ?? "Video", url: m.url, source: m.source ?? "url" }));
    }
    const structure = {
      areas: est.areas, addons: est.addons,
      deposit_type: est.deposit_type, deposit_value: est.deposit_value, payment_methods: est.payment_methods,
      project_overview: est.project_overview, notes: est.notes, videos,
    };
    await supabase.from("estimate_templates").insert({ vendor_id: vendorId, name: name.trim(), structure });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  }

  function patch(p: Partial<Estimate>) { setEst((prev) => ({ ...prev, ...p })); }

  function pullContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    patch({ contact_id: c.id, customer_name: c.name ?? "", customer_email: c.email ?? "", customer_phone: c.phone ?? "", customer_address: c.address ?? "" });
  }

  async function sendEstimate(channel: "email" | "internal") {
    setSendMsg(null);
    if (!est.customer_email?.trim()) { setSendMsg({ ok: false, text: "Add the customer's email first." }); return; }
    if (channel === "email" && !window.confirm(`Email this proposal to ${est.customer_email}?`)) return;
    setSending(channel);
    const id = await onSave(est);
    if (!id) { setSending(null); setSendMsg({ ok: false, text: "Could not save the proposal." }); return; }
    const res = await fetch("/api/estimate-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId: id, channel }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(null);
    if (res.ok) {
      setEst((prev) => ({ ...prev, id, status: "sent" }));
      setSendMsg({ ok: true, text: channel === "email" ? "Proposal emailed to the customer." : "Proposal sent as an in-app message." });
    } else if (data.error === "no_account") {
      setSendMsg({ ok: false, text: "That customer doesn't have an account — use “Email to customer” instead." });
    } else {
      setSendMsg({ ok: false, text: data.error ?? "Could not send the proposal." });
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <input value={est.title} onChange={(e) => patch({ title: e.target.value })}
          className="text-xl font-bold text-gray-900 border-b-2 border-green-400 focus:outline-none bg-transparent flex-1 min-w-0" />
        <select value={est.status} onChange={(e) => patch({ status: e.target.value })}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 shrink-0">
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Customer */}
      <div className="mb-5 bg-gray-50 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
          {contacts.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) pullContact(e.target.value); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Pull from CRM…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={est.customer_name ?? ""} onChange={(e) => patch({ customer_name: e.target.value })} placeholder="Name" className={inputCls} />
          <input value={est.customer_email ?? ""} onChange={(e) => patch({ customer_email: e.target.value })} type="email" placeholder="Email" className={inputCls} />
          <input value={est.customer_phone ?? ""} onChange={(e) => patch({ customer_phone: e.target.value })} type="tel" placeholder="Phone" className={inputCls} />
          <input value={est.customer_address ?? ""} onChange={(e) => patch({ customer_address: e.target.value })} placeholder="Address" className={inputCls} />
        </div>
      </div>

      {/* Body — shared with the template editor */}
      <ProposalStructureEditor
        value={{
          areas: est.areas, addons: est.addons,
          deposit_type: est.deposit_type, deposit_value: est.deposit_value, payment_methods: est.payment_methods,
          project_overview: est.project_overview, notes: est.notes,
        }}
        onChange={(s) => patch({
          areas: s.areas, addons: s.addons,
          deposit_type: s.deposit_type, deposit_value: s.deposit_value, payment_methods: s.payment_methods,
          project_overview: s.project_overview, notes: s.notes,
        })}
        catalog={catalog} snippets={snippets} totalLabel="Proposal total"
      />

      {/* Photos & videos (per-job) */}
      <ProposalMedia
        vendorId={vendorId} userId={userId} estimateId={est.id} areas={est.areas}
        ensureSaved={async () => await onSave(est)}
      />

      {/* Acceptance status */}
      {(est.deposit_paid_at || est.accepted_at) && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          {est.deposit_paid_at
            ? `✓ Deposit paid ${new Date(est.deposit_paid_at).toLocaleDateString()} — proposal accepted.`
            : `✓ Accepted by customer ${new Date(est.accepted_at!).toLocaleDateString()} (paying by check).`}
        </div>
      )}

      {/* Share + Send */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Share proposal</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={openCustomerView} disabled={linkBusy}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
            👁 Customer view
          </button>
          <button type="button" onClick={copyCustomerLink} disabled={linkBusy}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
            🔗 {copied ? "Link copied!" : "Copy link"}
          </button>
          <button type="button" onClick={saveAsTemplate}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            💾 {templateSaved ? "Saved to templates!" : "Save as template"}
          </button>
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send to customer</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => sendEstimate("internal")} disabled={sending !== null}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
            💬 {sending === "internal" ? "Sending…" : "Send as message"}
          </button>
          <button type="button" onClick={() => sendEstimate("email")} disabled={sending !== null}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40">
            📧 {sending === "email" ? "Sending…" : "Email to customer"}
          </button>
          <span className="text-xs text-gray-400 self-center">Text delivery arrives when Twilio is connected.</span>
        </div>
        {sendMsg && <p className={`text-xs mt-2 ${sendMsg.ok ? "text-green-600" : "text-red-500"}`}>{sendMsg.text}</p>}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={async () => { setSavingClose(true); const id = await onSave(est); setSavingClose(false); if (id) onClose(); }}
          disabled={savingClose}
          className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
          {savingClose ? "Saving…" : "Save Proposal"}
        </button>
        <button onClick={onClose} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

function TemplatePicker({ templates, onPick, onClose }: {
  templates: TemplateLite[]; onPick: (t: TemplateLite | null) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Start a proposal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          <button onClick={() => onPick(null)}
            className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:bg-green-50 transition-colors">
            <p className="font-semibold text-gray-900">Blank proposal</p>
            <p className="text-xs text-gray-400">Start from scratch with one empty area.</p>
          </button>
          {templates.map((t) => {
            const areas = (t.structure?.areas ?? []) as Area[];
            const addons = (t.structure?.addons ?? []) as Addon[];
            const total = estimateTotal(areas, addons);
            return (
              <button key={t.id} onClick={() => onPick(t)}
                className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:bg-green-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900 truncate">🧱 {t.name}</p>
                  <span className="text-sm font-bold text-green-700 shrink-0">${total.toFixed(2)}</span>
                </div>
                {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{areas.length} area{areas.length === 1 ? "" : "s"} · {addons.length} add-on{addons.length === 1 ? "" : "s"}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
