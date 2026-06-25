"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Column = { id: string; name: string; position: number };
type Contact = {
  id: string; column_id: string | null; name: string;
  email: string | null; phone: string | null; source: string; notes: string | null;
};

const DEFAULT_COLUMNS = [
  "Cold Lead", "Warm Lead", "Estimate Requested", "Booked", "Rejected"
];

interface Props { vendorId: string; onCreateEstimate: (contact: Contact) => void; }

export default function CrmBoard({ vendorId, onCreateEstimate }: Props) {
  const supabase = createClient();
  const [columns, setColumns] = useState<Column[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddContact, setShowAddContact] = useState<string | null>(null); // column_id
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragOver = useRef<string | null>(null);

  useEffect(() => { load(); }, [vendorId]);

  async function load() {
    setLoading(true);
    const [{ data: cols }, { data: conts }] = await Promise.all([
      supabase.from("crm_columns").select("*").eq("vendor_id", vendorId).order("position"),
      supabase.from("crm_contacts").select("*").eq("vendor_id", vendorId).order("created_at"),
    ]);

    if (!cols || cols.length === 0) {
      // Seed default columns
      const toInsert = DEFAULT_COLUMNS.map((name, i) => ({ vendor_id: vendorId, name, position: i }));
      const { data: seeded } = await supabase.from("crm_columns").insert(toInsert).select("*");
      setColumns((seeded ?? []).sort((a, b) => a.position - b.position));
    } else {
      setColumns(cols);
    }
    setContacts(conts ?? []);
    setLoading(false);
  }

  async function renameColumn(id: string, name: string) {
    await supabase.from("crm_columns").update({ name }).eq("id", id);
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
    setEditingColId(null);
  }

  async function addColumn() {
    const pos = columns.length;
    const { data } = await supabase.from("crm_columns").insert({ vendor_id: vendorId, name: "New Column", position: pos }).select("*").single();
    if (data) { setColumns((prev) => [...prev, data]); setEditingColId(data.id); setEditingColName(data.name); }
  }

  async function deleteColumn(id: string) {
    if (!confirm("Delete this column? Contacts will become uncategorized.")) return;
    await supabase.from("crm_contacts").update({ column_id: null }).eq("column_id", id);
    await supabase.from("crm_columns").delete().eq("id", id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setContacts((prev) => prev.map((c) => c.column_id === id ? { ...c, column_id: null } : c));
  }

  async function addContact(columnId: string) {
    if (!newContact.name.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("crm_contacts").insert({
      vendor_id: vendorId, column_id: columnId,
      name: newContact.name.trim(), email: newContact.email.trim() || null, phone: newContact.phone.trim() || null,
    }).select("*").single();
    if (data) setContacts((prev) => [...prev, data]);
    setNewContact({ name: "", email: "", phone: "" });
    setShowAddContact(null);
    setSaving(false);
  }

  async function moveContact(contactId: string, newColumnId: string) {
    await supabase.from("crm_contacts").update({ column_id: newColumnId }).eq("id", contactId);
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, column_id: newColumnId } : c));
  }

  async function updateNotes(contactId: string, notes: string) {
    await supabase.from("crm_contacts").update({ notes }).eq("id", contactId);
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, notes } : c));
    if (selectedContact?.id === contactId) setSelectedContact((prev) => prev ? { ...prev, notes } : prev);
  }

  async function deleteContact(id: string) {
    if (!confirm("Remove this contact?")) return;
    await supabase.from("crm_contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedContact(null);
  }

  function onDragStart(contactId: string) { setDragging(contactId); }
  function onDragOver(e: React.DragEvent, colId: string) { e.preventDefault(); dragOver.current = colId; }
  function onDrop(colId: string) {
    if (dragging && dragOver.current === colId) moveContact(dragging, colId);
    setDragging(null); dragOver.current = null;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Customer Pipeline</h2>
        <button onClick={addColumn} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">+ Add Column</button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {columns.map((col) => {
          const colContacts = contacts.filter((c) => c.column_id === col.id);
          return (
            <div
              key={col.id}
              className="shrink-0 w-60 flex flex-col bg-gray-50 rounded-2xl border border-gray-200"
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={() => onDrop(col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    value={editingColName}
                    onChange={(e) => setEditingColName(e.target.value)}
                    onBlur={() => renameColumn(col.id, editingColName)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameColumn(col.id, editingColName); }}
                    className="flex-1 text-sm font-semibold bg-white border border-green-400 rounded px-2 py-0.5 focus:outline-none"
                  />
                ) : (
                  <button
                    className="flex-1 text-left text-sm font-semibold text-gray-800 hover:text-green-700 truncate"
                    onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }}
                  >
                    {col.name}
                  </button>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5">{colContacts.length}</span>
                  <button onClick={() => deleteColumn(col.id)} className="text-gray-300 hover:text-red-400 text-xs ml-1">✕</button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                {colContacts.map((contact) => (
                  <div
                    key={contact.id}
                    draggable
                    onDragStart={() => onDragStart(contact.id)}
                    onClick={() => setSelectedContact(contact)}
                    className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-green-300 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{contact.name}</p>
                    {contact.email && <p className="text-xs text-gray-400 truncate">{contact.email}</p>}
                    {contact.phone && <p className="text-xs text-gray-400">{contact.phone}</p>}
                    {contact.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{contact.notes}"</p>}
                    <div className="flex gap-1 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{contact.source}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add contact */}
              <div className="p-2 border-t border-gray-200">
                {showAddContact === col.id ? (
                  <div className="space-y-1.5">
                    <input autoFocus value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="Name *" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500" />
                    <input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="Email" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500" />
                    <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="Phone" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500" />
                    <div className="flex gap-1.5">
                      <button onClick={() => addContact(col.id)} disabled={saving || !newContact.name.trim()}
                        className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors">
                        {saving ? "..." : "Add"}
                      </button>
                      <button onClick={() => setShowAddContact(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddContact(col.id)}
                    className="w-full text-xs text-gray-400 hover:text-green-600 py-1.5 hover:bg-green-50 rounded-lg transition-colors">
                    + Add contact
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contact detail modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          columns={columns}
          onMove={(colId) => { moveContact(selectedContact.id, colId); setSelectedContact({ ...selectedContact, column_id: colId }); }}
          onUpdateNotes={(notes) => updateNotes(selectedContact.id, notes)}
          onDelete={() => deleteContact(selectedContact.id)}
          onCreateEstimate={() => { onCreateEstimate(selectedContact); setSelectedContact(null); }}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}

function ContactModal({ contact, columns, onMove, onUpdateNotes, onDelete, onCreateEstimate, onClose }: {
  contact: Contact; columns: Column[];
  onMove: (colId: string) => void; onUpdateNotes: (notes: string) => void;
  onDelete: () => void; onCreateEstimate: () => void; onClose: () => void;
}) {
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [saved, setSaved] = useState(false);

  async function saveNotes() {
    await onUpdateNotes(notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const currentCol = columns.find((c) => c.id === contact.column_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{contact.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Contact info */}
          <div className="space-y-1">
            {contact.email && <p className="text-sm text-gray-600">✉️ {contact.email}</p>}
            {contact.phone && <p className="text-sm text-gray-600">📞 {contact.phone}</p>}
            <p className="text-xs text-gray-400">Source: {contact.source}</p>
          </div>

          {/* Move to column */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Pipeline Stage</label>
            <select
              value={contact.column_id ?? ""}
              onChange={(e) => onMove(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="" disabled>Select stage</option>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {currentCol && <p className="text-xs text-gray-400 mt-1">Currently in: {currentCol.name}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this contact..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <button onClick={saveNotes} className="mt-1 text-xs text-green-600 hover:underline font-semibold">
              {saved ? "✓ Saved" : "Save notes"}
            </button>
          </div>
        </div>

        <div className="px-5 pb-4 flex gap-2">
          <button onClick={onCreateEstimate}
            className="flex-1 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
            📋 Create Estimate
          </button>
          <button onClick={onDelete}
            className="text-sm text-red-500 hover:text-red-700 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
