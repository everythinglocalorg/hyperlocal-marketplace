"use client";

import { useState } from "react";

type MenuItem = { id: string; title: string; price: number | null };

// Dead-simple pickup ordering: tap + to add items, place the order. Pay at the truck.
export default function FoodOrderModal({ vendor, listings, currentUser, onClose }: {
  vendor: { id: string; business_name: string };
  listings: MenuItem[];
  currentUser: { id: string; full_name: string | null; phone?: string | null } | null;
  onClose: () => void;
}) {
  const items = listings.filter((l) => l.price != null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState(currentUser?.full_name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  const lineItems = items.filter((l) => (qty[l.id] ?? 0) > 0);
  const total = lineItems.reduce((s, l) => s + (Number(l.price) || 0) * (qty[l.id] ?? 0), 0);

  async function place() {
    if (lineItems.length === 0) return;
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/food-trucks/order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id, name: name.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null,
          items: lineItems.map((l) => ({ listing_id: l.id, qty: qty[l.id] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't place your order."); setSubmitting(false); return; }
      setDone(true);
    } catch { setError("Couldn't reach the server. Try again."); }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-10 px-6">
            <div className="text-5xl mb-3">🧾</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Order placed!</h3>
            <p className="text-sm text-gray-500 mb-6">{vendor.business_name} got your order. We&apos;ll ping you the moment it&apos;s ready for pickup.</p>
            <button onClick={onClose} className="bg-gray-900 text-white font-semibold px-8 py-3 rounded-full">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-gray-900">Order for pickup</h3>
                <p className="text-xs text-gray-400">{vendor.business_name}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-5">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400">No menu items to order yet — check back soon.</p>
              ) : items.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                    <p className="text-xs text-gray-500">${Number(l.price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(qty[l.id] ?? 0) > 0 && <button onClick={() => bump(l.id, -1)} aria-label="Remove one" className="w-8 h-8 rounded-full border border-gray-200 text-lg leading-none hover:bg-gray-50">−</button>}
                    {(qty[l.id] ?? 0) > 0 && <span className="w-5 text-center text-sm font-semibold">{qty[l.id]}</span>}
                    <button onClick={() => bump(l.id, 1)} aria-label="Add one" className="w-8 h-8 rounded-full bg-gray-900 text-white text-lg leading-none hover:bg-gray-700">+</button>
                  </div>
                </div>
              ))}

              {lineItems.length > 0 && (
                <div className="mt-4 space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (e.g. no onions)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              )}
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
              <button onClick={place} disabled={lineItems.length === 0 || submitting}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40">
                {submitting ? "Placing…" : lineItems.length === 0 ? "Add items to order" : `Place pickup order · $${total.toFixed(2)}`}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2">Pay at the truck when you pick up.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
