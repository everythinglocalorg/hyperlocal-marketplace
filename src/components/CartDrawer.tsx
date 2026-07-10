"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart";

// Slide-over cart. Items accumulate from a single store (see lib/cart). Checkout
// sends the vendor an order request (purchase_inquiries) — the same lead flow
// "Buy Now" uses today — then clears the cart. Real Stripe checkout can slot in
// here later without changing the single-vendor model.
export default function CartDrawer() {
  const { isOpen, close, vendor, items, count, subtotal, setQty, removeItem, clear } = useCart();
  const supabase = createClient();
  const [view, setView] = useState<"cart" | "checkout" | "done">("cart");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Prefill contact info for signed-in shoppers.
  useEffect(() => {
    if (!isOpen) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setEmail((e) => e || user.email || "");
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single();
      if (p) { setName((n) => n || p.full_name || ""); setPhone((ph) => ph || p.phone || ""); }
    });
  }, [isOpen, supabase]);

  // Reset back to the cart view whenever it's reopened after an order.
  useEffect(() => { if (isOpen && view === "done") setView("cart"); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  async function placeOrder() {
    if (!vendor) return;
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setSubmitting(true);
    setError("");
    // One order request per line item so each shows up against its listing.
    const rows = items.map((it) => ({
      listing_id: it.listingId,
      vendor_id: vendor.id,
      buyer_id: userId,
      buyer_name: name.trim(),
      buyer_email: email.trim(),
      buyer_phone: phone.trim() || null,
      message: `Cart order — Qty ${it.qty} × ${it.title} (${formatPrice(it.price)} ea)${note.trim() ? ` · ${note.trim()}` : ""}`,
      inquiry_type: "buy",
      listing_title: it.title,
      is_read: false,
    }));
    const { error: err } = await supabase.from("purchase_inquiries").insert(rows);
    setSubmitting(false);
    if (err) { setError("Something went wrong. Please try again."); return; }
    clear();
    setView("done");
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-black text-gray-900 text-lg">🛒 Your Cart{count > 0 ? ` (${count})` : ""}</h2>
          <button onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {view === "done" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Order request sent!</h3>
            <p className="text-sm text-gray-500 mb-6">The store will reach out to finalize your order and payment.</p>
            <button onClick={close} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">Done</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-3 opacity-40">🛒</div>
            <p className="text-gray-500">Your cart is empty.</p>
            <p className="text-xs text-gray-400 mt-1">Add items from a store to get started.</p>
          </div>
        ) : (
          <>
            {vendor && (
              <div className="px-5 py-2.5 bg-green-50 border-b border-green-100 text-sm text-green-800 shrink-0">
                Ordering from <strong>{vendor.name}</strong>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((it) => (
                <div key={it.listingId} className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{it.title}</p>
                    <p className="text-sm text-green-700 font-bold mt-0.5">{formatPrice(it.price)}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="inline-flex items-center border border-gray-200 rounded-lg">
                        <button onClick={() => setQty(it.listingId, it.qty - 1)} className="w-7 h-7 text-gray-500 hover:bg-gray-50 rounded-l-lg">−</button>
                        <span className="w-8 text-center text-sm">{it.qty}</span>
                        <button onClick={() => setQty(it.listingId, it.qty + 1)} className="w-7 h-7 text-gray-500 hover:bg-gray-50 rounded-r-lg">+</button>
                      </div>
                      <button onClick={() => removeItem(it.listingId)} className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-700 shrink-0">{formatPrice(it.price * it.qty)}</div>
                </div>
              ))}
            </div>

            {/* Checkout form */}
            {view === "checkout" && (
              <div className="px-5 py-3 border-t border-gray-100 space-y-2.5 overflow-y-auto max-h-[45%] shrink-0">
                <div className="grid grid-cols-2 gap-2.5">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes for the store (optional)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-lg font-black text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              {view === "checkout" ? (
                <button onClick={placeOrder} disabled={submitting} className="w-full bg-green-600 text-white font-black py-3.5 rounded-2xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {submitting ? "Sending…" : "Send order request →"}
                </button>
              ) : (
                <button onClick={() => setView("checkout")} className="w-full bg-green-600 text-white font-black py-3.5 rounded-2xl hover:bg-green-700 transition-colors">
                  Checkout →
                </button>
              )}
              <p className="text-[11px] text-gray-400 text-center mt-2">One store per cart · the store confirms your order & payment.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
