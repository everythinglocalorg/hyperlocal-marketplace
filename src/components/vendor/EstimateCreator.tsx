"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type LineItem = { id: string; description: string; qty: number; unit_price: number };
type Contact = { id: string; name: string; email: string | null; phone: string | null; address?: string | null };
type Estimate = {
  id: string; title: string; status: string; line_items: LineItem[];
  notes: string | null; contact_id: string | null; created_at: string;
  contact?: Contact | null;
  customer_name?: string | null; customer_email?: string | null;
  customer_phone?: string | null; customer_address?: string | null;
};

interface Props { vendorId: string; defaultContact?: Contact | null; onBack: () => void; }

export default function EstimateCreator({ vendorId, defaultContact, onBack }: Props) {
  const supabase = createClient();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [printing, setPrinting] = useState<Estimate | null>(null);

  useEffect(() => { loadEstimates(); }, [vendorId]);

  useEffect(() => {
    if (defaultContact) openNew(defaultContact);
  }, [defaultContact]);

  async function loadEstimates() {
    const { data } = await supabase
      .from("estimates")
      .select("*, contact:crm_contacts(id, name, email, phone)")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    setEstimates((data ?? []).map((e: any) => ({
      ...e,
      line_items: e.line_items ?? [],
      contact: Array.isArray(e.contact) ? e.contact[0] : e.contact,
    })));
    setLoading(false);
  }

  function openNew(contact?: Contact | null) {
    setEditing({
      id: "", title: "New Estimate", status: "draft",
      line_items: [{ id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0 }],
      notes: null, contact_id: contact?.id ?? null, created_at: new Date().toISOString(),
      contact: contact ?? null,
      customer_name: contact?.name ?? "", customer_email: contact?.email ?? "",
      customer_phone: contact?.phone ?? "", customer_address: contact?.address ?? "",
    });
  }

  // Upsert the estimate and return its id (does not close the editor)
  async function saveEstimate(est: Estimate): Promise<string | null> {
    const payload = {
      vendor_id: vendorId, title: est.title, status: est.status,
      line_items: est.line_items, notes: est.notes, contact_id: est.contact_id,
      customer_name: est.customer_name?.trim() || null,
      customer_email: est.customer_email?.trim() || null,
      customer_phone: est.customer_phone?.trim() || null,
      customer_address: est.customer_address?.trim() || null,
    };
    if (est.id) {
      await supabase.from("estimates").update(payload).eq("id", est.id);
      setEstimates((prev) => prev.map((e) => e.id === est.id ? { ...est } : e));
      return est.id;
    } else {
      const { data } = await supabase.from("estimates").insert(payload).select("id").single();
      if (data) { setEstimates((prev) => [{ ...est, id: data.id }, ...prev]); return data.id; }
      return null;
    }
  }

  async function deleteEstimate(id: string) {
    if (!confirm("Delete this estimate?")) return;
    await supabase.from("estimates").delete().eq("id", id);
    setEstimates((prev) => prev.filter((e) => e.id !== id));
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };

  if (printing) return <PrintView estimate={printing} onClose={() => setPrinting(null)} />;

  if (editing) return (
    <EstimateEditor
      estimate={editing}
      vendorId={vendorId}
      onSave={saveEstimate}
      onClose={() => setEditing(null)}
    />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">← Back to CRM</button>
          <h2 className="text-lg font-bold text-gray-900">Estimates & Proposals</h2>
        </div>
        <button onClick={() => openNew(defaultContact)}
          className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
          + New Estimate
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : estimates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-600 mb-1">No estimates yet</p>
          <p className="text-sm">Create your first estimate or proposal</p>
          <button onClick={() => openNew()} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">Create Estimate</button>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((est) => {
            const total = est.line_items.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
            return (
              <div key={est.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 truncate">{est.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[est.status]}`}>{est.status}</span>
                  </div>
                  {(est.customer_name ?? est.contact?.name) && <p className="text-xs text-gray-400">{est.customer_name ?? est.contact?.name}</p>}
                  <p className="text-xs text-gray-400">{new Date(est.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-lg font-bold text-green-700 shrink-0">${total.toFixed(2)}</p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(est)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                  <button onClick={() => setPrinting(est)} className="text-xs border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50">Print</button>
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

function EstimateEditor({ estimate, vendorId, onSave, onClose }: {
  estimate: Estimate; vendorId: string;
  onSave: (e: Estimate) => Promise<string | null>; onClose: () => void;
}) {
  const supabase = createClient();
  const [est, setEst] = useState<Estimate>({ ...estimate, line_items: estimate.line_items.map((li) => ({ ...li })) });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sending, setSending] = useState<null | "email" | "internal">(null);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingClose, setSavingClose] = useState(false);

  useEffect(() => {
    supabase.from("crm_contacts").select("id, name, email, phone, address").eq("vendor_id", vendorId).order("name")
      .then(({ data }) => setContacts((data as Contact[]) ?? []));
  }, [vendorId, supabase]);

  function pullContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setEst((prev) => ({
      ...prev, contact_id: c.id,
      customer_name: c.name ?? "", customer_email: c.email ?? "",
      customer_phone: c.phone ?? "", customer_address: c.address ?? "",
    }));
  }

  async function sendEstimate(channel: "email" | "internal") {
    setSendMsg(null);
    if (!est.customer_email?.trim()) {
      setSendMsg({ ok: false, text: "Add the customer's email first." });
      return;
    }
    if (channel === "email" && !window.confirm(`Email this estimate to ${est.customer_email}?`)) return;
    setSending(channel);
    const id = await onSave(est); // ensure saved, get id
    if (!id) { setSending(null); setSendMsg({ ok: false, text: "Could not save the estimate." }); return; }
    const res = await fetch("/api/estimate-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId: id, channel }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(null);
    if (res.ok) {
      setEst((prev) => ({ ...prev, id, status: "sent" }));
      setSendMsg({ ok: true, text: channel === "email" ? "Estimate emailed to the customer." : "Estimate sent as an in-app message." });
    } else if (data.error === "no_account") {
      setSendMsg({ ok: false, text: "That customer doesn't have an account — use “Email to customer” instead." });
    } else {
      setSendMsg({ ok: false, text: data.error ?? "Could not send the estimate." });
    }
  }

  function updateLine(id: string, field: keyof LineItem, value: string | number) {
    setEst((prev) => ({ ...prev, line_items: prev.line_items.map((li) => li.id === id ? { ...li, [field]: value } : li) }));
  }

  function addLine() {
    setEst((prev) => ({ ...prev, line_items: [...prev.line_items, { id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0 }] }));
  }

  function removeLine(id: string) {
    setEst((prev) => ({ ...prev, line_items: prev.line_items.filter((li) => li.id !== id) }));
  }

  const total = est.line_items.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <input
          value={est.title}
          onChange={(e) => setEst({ ...est, title: e.target.value })}
          className="text-xl font-bold text-gray-900 border-b-2 border-green-400 focus:outline-none bg-transparent w-full max-w-xs"
        />
        <select
          value={est.status}
          onChange={(e) => setEst({ ...est, status: e.target.value })}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Customer info — pull from CRM or enter manually */}
      <div className="mb-5 bg-gray-50 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
          {contacts.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) pullContact(e.target.value); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Pull from CRM…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={est.customer_name ?? ""} onChange={(e) => setEst({ ...est, customer_name: e.target.value })}
            placeholder="Name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input value={est.customer_email ?? ""} onChange={(e) => setEst({ ...est, customer_email: e.target.value })}
            type="email" placeholder="Email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input value={est.customer_phone ?? ""} onChange={(e) => setEst({ ...est, customer_phone: e.target.value })}
            type="tel" placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input value={est.customer_address ?? ""} onChange={(e) => setEst({ ...est, customer_address: e.target.value })}
            placeholder="Address" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      {/* Line items */}
      <div className="mb-4">
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
          <span className="col-span-6">Description</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-3 text-right">Unit Price</span>
          <span className="col-span-1"></span>
        </div>
        <div className="space-y-2">
          {est.line_items.map((li) => (
            <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={li.description}
                onChange={(e) => updateLine(li.id, "description", e.target.value)}
                placeholder="Item description"
                className="col-span-6 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" min="1"
                value={li.qty}
                onChange={(e) => updateLine(li.id, "qty", Number(e.target.value))}
                className="col-span-2 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="col-span-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={li.unit_price}
                  onChange={(e) => updateLine(li.id, "unit_price", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button onClick={() => removeLine(li.id)} className="col-span-1 text-gray-300 hover:text-red-400 text-center">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-3 text-sm text-green-600 hover:underline font-semibold">+ Add line item</button>
      </div>

      {/* Total */}
      <div className="border-t border-gray-100 pt-4 mb-4 text-right">
        <p className="text-sm text-gray-500">Total</p>
        <p className="text-2xl font-bold text-green-700">${total.toFixed(2)}</p>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes / Terms</label>
        <textarea
          rows={3}
          value={est.notes ?? ""}
          onChange={(e) => setEst({ ...est, notes: e.target.value })}
          placeholder="Payment terms, project details, expiry date..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      {/* Send options */}
      <div className="mb-4 border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send proposal</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => sendEstimate("internal")} disabled={sending !== null}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            💬 {sending === "internal" ? "Sending…" : "Send as message"}
          </button>
          <button
            type="button" onClick={() => sendEstimate("email")} disabled={sending !== null}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            📧 {sending === "email" ? "Sending…" : "Email to customer"}
          </button>
        </div>
        {sendMsg && (
          <p className={`text-xs mt-2 ${sendMsg.ok ? "text-green-600" : "text-red-500"}`}>{sendMsg.text}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={async () => { setSavingClose(true); const id = await onSave(est); setSavingClose(false); if (id) onClose(); }}
          disabled={savingClose}
          className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {savingClose ? "Saving…" : "Save Estimate"}
        </button>
        <button onClick={onClose} className="px-6 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function PrintView({ estimate, onClose }: { estimate: Estimate; onClose: () => void }) {
  const total = estimate.line_items.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <div className="max-w-2xl mx-auto px-8 py-10 print:py-4">
        {/* Print controls */}
        <div className="flex gap-3 mb-8 print:hidden">
          <button onClick={() => window.print()} className="bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-700 transition-colors">🖨️ Print / Save PDF</button>
          <button onClick={onClose} className="border border-gray-200 text-gray-600 px-6 py-2 rounded-xl hover:bg-gray-50 transition-colors">← Back</button>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-bold text-green-700 mb-1">ESTIMATE</h1>
            <p className="text-gray-500 text-sm">Date: {new Date(estimate.created_at).toLocaleDateString()}</p>
            <p className="text-gray-500 text-sm capitalize">Status: {estimate.status}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-xl text-gray-900">{estimate.title}</p>
          </div>
        </div>

        {/* Client info */}
        {(estimate.customer_name ?? estimate.contact?.name) && (
          <div className="mb-8 bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Prepared for</p>
            <p className="font-bold text-gray-900">{estimate.customer_name ?? estimate.contact?.name}</p>
            {(estimate.customer_email ?? estimate.contact?.email) && <p className="text-gray-500 text-sm">{estimate.customer_email ?? estimate.contact?.email}</p>}
            {(estimate.customer_phone ?? estimate.contact?.phone) && <p className="text-gray-500 text-sm">{estimate.customer_phone ?? estimate.contact?.phone}</p>}
            {estimate.customer_address && <p className="text-gray-500 text-sm">{estimate.customer_address}</p>}
          </div>
        )}

        {/* Line items */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-sm font-semibold text-gray-600">Description</th>
              <th className="text-center py-2 text-sm font-semibold text-gray-600 w-16">Qty</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-600 w-28">Unit Price</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-600 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {estimate.line_items.map((li) => (
              <tr key={li.id} className="border-b border-gray-100">
                <td className="py-3 text-sm text-gray-800">{li.description}</td>
                <td className="py-3 text-sm text-gray-600 text-center">{li.qty}</td>
                <td className="py-3 text-sm text-gray-600 text-right">${li.unit_price.toFixed(2)}</td>
                <td className="py-3 text-sm font-semibold text-gray-900 text-right">${(li.qty * li.unit_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right pt-4 font-bold text-gray-700 text-sm pr-4">TOTAL</td>
              <td className="text-right pt-4 font-bold text-green-700 text-xl">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {estimate.notes && (
          <div className="bg-gray-50 rounded-xl p-4 mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes & Terms</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{estimate.notes}</p>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-300 print:block hidden">
          Generated by Everything Local
        </div>
      </div>
    </div>
  );
}
