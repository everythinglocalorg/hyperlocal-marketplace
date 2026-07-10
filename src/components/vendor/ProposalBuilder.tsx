"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ProposalMedia from "@/components/vendor/ProposalMedia";
import {
  CatalogItem, Area, Addon, ProposalLine, DepositType, PaymentMethod, ProposalStructure,
  UNIT_LABEL, UnitBasis, computeLineTotal, areaTotal, estimateTotal, depositAmount,
  toFlatLineItems, newArea, newAddon, newLineFromCatalog, newBlankLine, round2,
  cloneStructureWithNewIds,
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
      areas: normalizeAreas(e),
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

  function openNew(contact?: Contact | null, template?: TemplateLite | null) {
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
    setEditing({
      id: "", title: template ? template.name : "New Proposal", status: "draft",
      line_items: [],
      areas: s && s.areas.length ? s.areas : [{ ...newArea(), name: "Main Area" }],
      addons: s?.addons ?? [],
      deposit_type: s?.deposit_type ?? "percent", deposit_value: s?.deposit_value ?? 50,
      payment_methods: s?.payment_methods ?? ["card"],
      project_overview: s?.project_overview ?? null, notes: s?.notes ?? null,
      share_token: null, accepted_at: null, deposit_paid_at: null,
      contact_id: contact?.id ?? null, created_at: new Date().toISOString(), contact: contact ?? null,
      customer_name: contact?.name ?? "", customer_email: contact?.email ?? "",
      customer_phone: contact?.phone ?? "", customer_address: contact?.address ?? "",
    });
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

  function insertSnippet(field: "project_overview" | "notes", body: string) {
    const current = (est[field] ?? "").trim();
    patch({ [field]: current ? `${current}\n\n${body}` : body } as Partial<Estimate>);
  }

  async function saveAsTemplate() {
    const name = window.prompt("Save this proposal as a reusable template.\nTemplate name:", est.title);
    if (!name?.trim()) return;
    const structure = {
      areas: est.areas, addons: est.addons,
      deposit_type: est.deposit_type, deposit_value: est.deposit_value, payment_methods: est.payment_methods,
      project_overview: est.project_overview, notes: est.notes,
    };
    await supabase.from("estimate_templates").insert({ vendor_id: vendorId, name: name.trim(), structure });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  }

  const total = estimateTotal(est.areas, est.addons);
  const optionalTotal = round2(est.areas.filter((a) => a.optional).reduce((s, a) => s + areaTotal(a), 0));
  const deposit = depositAmount(total, est.deposit_type, est.deposit_value);

  function patch(p: Partial<Estimate>) { setEst((prev) => ({ ...prev, ...p })); }

  function pullContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    patch({ contact_id: c.id, customer_name: c.name ?? "", customer_email: c.email ?? "", customer_phone: c.phone ?? "", customer_address: c.address ?? "" });
  }

  // ── Area / line mutations ──
  function updateArea(id: string, p: Partial<Area>) {
    patch({ areas: est.areas.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  }
  function removeArea(id: string) {
    patch({ areas: est.areas.filter((a) => a.id !== id) });
  }
  function addArea(optional: boolean) {
    patch({ areas: [...est.areas, newArea(optional)] });
  }
  function updateLine(areaId: string, lineId: string, p: Partial<ProposalLine>) {
    patch({ areas: est.areas.map((a) => a.id !== areaId ? a : { ...a, lines: a.lines.map((l) => (l.id === lineId ? { ...l, ...p } : l)) }) });
  }
  function addLine(areaId: string, item?: CatalogItem) {
    const line = item ? newLineFromCatalog(item) : newBlankLine();
    patch({ areas: est.areas.map((a) => (a.id === areaId ? { ...a, lines: [...a.lines, line] } : a)) });
  }
  function removeLine(areaId: string, lineId: string) {
    patch({ areas: est.areas.map((a) => (a.id === areaId ? { ...a, lines: a.lines.filter((l) => l.id !== lineId) } : a)) });
  }

  // ── Add-ons ──
  function updateAddon(id: string, p: Partial<Addon>) { patch({ addons: est.addons.map((a) => (a.id === id ? { ...a, ...p } : a)) }); }
  function removeAddon(id: string) { patch({ addons: est.addons.filter((a) => a.id !== id) }); }

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

      {catalog.length === 0 && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2">
          Tip: set up your <strong>Price Book</strong> to add products with one click and auto-calculate totals. You can also add custom lines below.
        </div>
      )}

      {/* Areas */}
      <div className="space-y-4">
        {est.areas.map((area) => (
          <AreaCard key={area.id} area={area} catalog={catalog}
            onUpdate={(p) => updateArea(area.id, p)}
            onRemove={() => removeArea(area.id)}
            onAddLine={(item) => addLine(area.id, item)}
            onUpdateLine={(lineId, p) => updateLine(area.id, lineId, p)}
            onRemoveLine={(lineId) => removeLine(area.id, lineId)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => addArea(false)} className="text-sm font-semibold text-green-700 border border-green-200 px-4 py-2 rounded-xl hover:bg-green-50 transition-colors">+ Add Area</button>
        <button onClick={() => addArea(true)} className="text-sm font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">+ Add Optional Area</button>
      </div>

      {/* Add-ons */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optional Add-ons</p>
          <button onClick={() => patch({ addons: [...est.addons, newAddon()] })} className="text-xs text-green-600 hover:underline font-semibold">+ Add add-on</button>
        </div>
        {est.addons.length === 0 ? (
          <p className="text-xs text-gray-400">Warranties, upgrades, extras the customer can opt into.</p>
        ) : (
          <div className="space-y-2">
            {est.addons.map((addon) => (
              <div key={addon.id} className="grid grid-cols-12 gap-2 items-center bg-white border border-gray-100 rounded-xl p-3">
                <input value={addon.name} onChange={(e) => updateAddon(addon.id, { name: e.target.value })} placeholder="e.g. 3-yr workmanship warranty"
                  className="col-span-12 sm:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={addon.description} onChange={(e) => updateAddon(addon.id, { description: e.target.value })} placeholder="Short description"
                  className="col-span-7 sm:col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <div className="col-span-3 sm:col-span-2 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={addon.total} onChange={(e) => updateAddon(addon.id, { total: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button onClick={() => updateAddon(addon.id, { included: !addon.included })}
                  className={`col-span-2 sm:col-span-2 text-xs font-semibold px-2 py-2 rounded-lg transition-colors ${addon.included ? "bg-green-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {addon.included ? "Added" : "Not incl."}
                </button>
                <button onClick={() => removeAddon(addon.id)} className="hidden sm:block col-span-12 sm:col-span-0 text-gray-300 hover:text-red-400 text-center">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photos & videos */}
      <ProposalMedia
        vendorId={vendorId} userId={userId} estimateId={est.id} areas={est.areas}
        ensureSaved={async () => await onSave(est)}
      />

      {/* Project overview / notes */}
      <div className="mt-6 grid grid-cols-1 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Project overview</span>
            <SnippetInsert snippets={snippets.filter((s) => s.kind === "snippet")} onInsert={(b) => insertSnippet("project_overview", b)} />
          </div>
          <textarea rows={3} value={est.project_overview ?? ""} onChange={(e) => patch({ project_overview: e.target.value })}
            placeholder="Scope, colors selected, timeframe, key highlights… (Markdown + links supported)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes / Terms</span>
            <SnippetInsert snippets={snippets.filter((s) => s.kind === "note")} onInsert={(b) => insertSnippet("notes", b)} />
          </div>
          <textarea rows={2} value={est.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Payment terms, expiry date…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
      </div>

      {/* Totals + deposit */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">Proposal total</span>
          <span className="text-2xl font-bold text-green-700">${total.toFixed(2)}</span>
        </div>
        {optionalTotal > 0 && (
          <p className="text-xs text-gray-400 text-right mb-3">+ ${optionalTotal.toFixed(2)} in optional areas (not included)</p>
        )}

        <div className="mt-3 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deposit</p>
          <div className="flex flex-wrap items-center gap-2">
            <DepositChip active={est.deposit_type === "percent" && est.deposit_value === 50} onClick={() => patch({ deposit_type: "percent", deposit_value: 50 })}>50%</DepositChip>
            <DepositChip active={est.deposit_type === "percent" && est.deposit_value === 100} onClick={() => patch({ deposit_type: "percent", deposit_value: 100 })}>100%</DepositChip>
            <div className="flex items-center gap-1.5 ml-1">
              <select value={est.deposit_type} onChange={(e) => patch({ deposit_type: e.target.value as DepositType })}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="percent">Custom %</option>
                <option value="flat">Flat $</option>
              </select>
              <input type="number" min={0} step="0.01" value={est.deposit_value}
                onChange={(e) => patch({ deposit_value: Number(e.target.value) })}
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <span className="ml-auto text-sm text-gray-600">Deposit due: <strong className="text-gray-900">${deposit.toFixed(2)}</strong></span>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Customer can pay by</p>
          <div className="flex gap-2">
            <PayToggle active={est.payment_methods.includes("card")} onClick={() => togglePay("card")}>💳 Card</PayToggle>
            <PayToggle active={est.payment_methods.includes("check")} onClick={() => togglePay("check")}>🧾 Check</PayToggle>
          </div>
        </div>
      </div>

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

  function togglePay(m: PaymentMethod) {
    const has = est.payment_methods.includes(m);
    const next = has ? est.payment_methods.filter((x) => x !== m) : [...est.payment_methods, m];
    patch({ payment_methods: next });
  }
}

// ── Area card ────────────────────────────────────────────────────────────────
function AreaCard({ area, catalog, onUpdate, onRemove, onAddLine, onUpdateLine, onRemoveLine }: {
  area: Area; catalog: CatalogItem[];
  onUpdate: (p: Partial<Area>) => void; onRemove: () => void;
  onAddLine: (item?: CatalogItem) => void;
  onUpdateLine: (lineId: string, p: Partial<ProposalLine>) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = areaTotal(area);

  return (
    <div className={`border rounded-2xl ${area.optional ? "border-dashed border-gray-300 bg-gray-50/50" : "border-gray-200 bg-white"}`}>
      {/* Area header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setCollapsed((c) => !c)} className="text-gray-400 hover:text-gray-600 text-sm w-4">{collapsed ? "▸" : "▾"}</button>
        <input value={area.name} onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-semibold text-gray-900 bg-transparent focus:outline-none flex-1 min-w-0 border-b border-transparent focus:border-green-300" />
        {area.optional && <span className="text-[10px] uppercase tracking-wide font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Optional</span>}
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="number" min={0} step="0.5" value={area.hours} onChange={(e) => onUpdate({ hours: Number(e.target.value) })}
            className="w-14 border border-gray-200 rounded px-1.5 py-1 text-right focus:outline-none focus:ring-1 focus:ring-green-500" /> hrs
        </label>
        <span className="text-sm font-bold text-gray-800 w-24 text-right">${total.toFixed(2)}</span>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
      </div>

      {!collapsed && (
        <div className="px-4 py-3">
          {/* Prep note banner */}
          <input value={area.prep_note} onChange={(e) => onUpdate({ prep_note: e.target.value })}
            placeholder="Preparation grade / prep notes (shown as a banner to the customer)…"
            className="w-full text-xs bg-amber-50 border border-amber-100 text-amber-800 placeholder-amber-400 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-300" />

          {/* Lines */}
          {area.lines.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                <span className="col-span-5">Item</span>
                <span className="col-span-3 text-center">Measurement</span>
                <span className="col-span-1 text-center">Coats</span>
                <span className="col-span-2 text-right">Total</span>
                <span className="col-span-1" />
              </div>
              {area.lines.map((line) => (
                <LineRow key={line.id} line={line} onUpdate={(p) => onUpdateLine(line.id, p)} onRemove={() => onRemoveLine(line.id)} />
              ))}
            </div>
          )}

          {/* Add line */}
          <div className="flex flex-wrap items-center gap-2">
            {catalog.length > 0 && (
              <select value="" onChange={(e) => { const item = catalog.find((c) => c.id === e.target.value); if (item) onAddLine(item); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">+ Add item from price book…</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.substrate} · {c.name}</option>)}
              </select>
            )}
            <button onClick={() => onAddLine()} className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">+ Custom line</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Line row ─────────────────────────────────────────────────────────────────
function LineRow({ line, onUpdate, onRemove }: {
  line: ProposalLine; onUpdate: (p: Partial<ProposalLine>) => void; onRemove: () => void;
}) {
  const computed = computeLineTotal({ ...line, manual_total: null });
  const total = computeLineTotal(line);
  const overridden = line.manual_total != null;
  const coverage = line.unit_basis === "sqft" || line.unit_basis === "linear_ft";

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-12 sm:col-span-5">
        <input value={line.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Item name"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        {(line.product_line || line.catalog_item_id) && (
          <p className="text-[11px] text-gray-400 mt-0.5 px-1 truncate">{line.product_line ?? "Custom"} · {UNIT_LABEL[line.unit_basis]}</p>
        )}
      </div>
      <div className="col-span-5 sm:col-span-3 flex items-center gap-1">
        <input type="number" min={0} step="0.01" value={line.measurement} onChange={(e) => onUpdate({ measurement: Number(e.target.value) })}
          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
        {!line.catalog_item_id ? (
          <select value={line.unit_basis} onChange={(e) => onUpdate({ unit_basis: e.target.value as UnitBasis })}
            className="border border-gray-200 rounded-lg px-1 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500">
            {(["sqft", "linear_ft", "each", "hour"] as UnitBasis[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        ) : (
          <span className="text-xs text-gray-400 w-14 shrink-0">{UNIT_LABEL[line.unit_basis]}</span>
        )}
      </div>
      <div className="col-span-3 sm:col-span-1">
        {coverage ? (
          <input type="number" min={1} value={line.coats} onChange={(e) => onUpdate({ coats: Number(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg px-1 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
        ) : <div className="text-center text-gray-300 text-xs">—</div>}
      </div>
      <div className="col-span-3 sm:col-span-2 relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input type="number" min={0} step="0.01" value={total}
          onChange={(e) => onUpdate({ manual_total: e.target.value === "" ? null : Number(e.target.value) })}
          title={overridden ? `Manual override (auto: $${computed.toFixed(2)})` : "Auto-calculated — edit to override"}
          className={`w-full border rounded-lg pl-5 pr-1 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500 ${overridden ? "border-amber-300 bg-amber-50" : "border-gray-200"}`} />
      </div>
      <div className="col-span-1 flex items-center justify-end gap-1">
        {overridden && <button onClick={() => onUpdate({ manual_total: null })} title="Reset to auto" className="text-gray-300 hover:text-green-500 text-xs">↺</button>}
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

function SnippetInsert({ snippets, onInsert }: {
  snippets: { id: string; title: string; body: string }[]; onInsert: (body: string) => void;
}) {
  if (snippets.length === 0) return null;
  return (
    <select value="" onChange={(e) => { const s = snippets.find((x) => x.id === e.target.value); if (s) onInsert(s.body); }}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500">
      <option value="">+ Insert snippet…</option>
      {snippets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
    </select>
  );
}

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

function DepositChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${active ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{children}</button>
  );
}

function PayToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${active ? "bg-green-50 border border-green-300 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{children}</button>
  );
}
