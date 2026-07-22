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
  const [fulfillment, setFulfillment] = useState<"porch_pickup" | "local_drop" | "">("");
  // Captured at order time so the confirmation can show it after the cart clears.
  const [confirmed, setConfirmed] = useState<{ label: string; locations: string[] } | null>(null);

  // A method is only offered if EVERY item in the cart supports it (single store,
  // but items can differ). Porch Pickup = buyer collects; Local Drop = seller drops off.
  const allPorch = items.length > 0 && items.every((i) => i.porchPickup);
  const allDrop = items.length > 0 && items.every((i) => i.localDrop);
  const fulfillmentOpts = [
    ...(allPorch ? [{ id: "porch_pickup" as const, label: "🏡 Porch Pickup", hint: "You pick it up" }] : []),
    ...(allDrop ? [{ id: "local_drop" as const, label: "🚗 Local Drop", hint: "Meet at their spot" }] : []),
  ];

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

  // Auto-select when a single method is offered; otherwise the buyer must pick.
  const chosenFulfillment = fulfillment || (fulfillmentOpts.length === 1 ? fulfillmentOpts[0].id : "");

  // The location(s) to reveal for the chosen method — usually one shared spot.
  const fLocations: string[] = (() => {
    if (!chosenFulfillment) return [];
    const vals = items.map((i) => (chosenFulfillment === "porch_pickup" ? i.pickupInfo : i.dropInfo)).filter(Boolean) as string[];
    return [...new Set(vals)];
  })();

  async function placeOrder() {
    if (!vendor) return;
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    if (fulfillmentOpts.length > 0 && !chosenFulfillment) { setError("Choose how you'd like to get your order."); return; }
    setSubmitting(true);
    setError("");
    const fLabel = chosenFulfillment === "porch_pickup" ? "🏡 Porch Pickup" : chosenFulfillment === "local_drop" ? "🚗 Local Drop" : null;
    // One order request per line item so each shows up against its listing.
    const rows = items.map((it) => {
      const itLoc = chosenFulfillment === "porch_pickup" ? it.pickupInfo : chosenFulfillment === "local_drop" ? it.dropInfo : null;
      const row: Record<string, unknown> = {
        listing_id: it.listingId,
        vendor_id: vendor.id,
        buyer_id: userId,
        buyer_name: name.trim(),
        buyer_email: email.trim(),
        buyer_phone: phone.trim() || null,
        message: `Cart order — Qty ${it.qty} × ${it.title} (${formatPrice(it.price)} ea)${fLabel ? ` · ${fLabel}${itLoc ? ` (${itLoc})` : ""}` : ""}${note.trim() ? ` · ${note.trim()}` : ""}`,
        inquiry_type: "buy",
        listing_title: it.title,
        is_read: false,
      };
      // Only attach the column when set, so checkout still works before the
      // supabase/local_pickup.sql migration is applied.
      if (chosenFulfillment) row.fulfillment = chosenFulfillment;
      return row;
    });
    const { error: err } = await supabase.from("purchase_inquiries").insert(rows);
    setSubmitting(false);
    if (err) { setError("Something went wrong. Please try again."); return; }
    if (fLabel) setConfirmed({ label: fLabel, locations: fLocations });
    else setConfirmed(null);
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
            {confirmed && (
              <div className="w-full max-w-xs rounded-xl bg-green-50 border border-green-100 px-4 py-3 mb-4 text-left">
                <p className="text-xs font-semibold text-green-700 mb-0.5">{confirmed.label}</p>
                {confirmed.locations.length > 0 ? (
                  confirmed.locations.map((loc, i) => <p key={i} className="text-sm text-green-800 whitespace-pre-line">{loc}</p>)
                ) : (
                  <p className="text-sm text-green-800">The store will share the details shortly.</p>
                )}
              </div>
            )}
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
                {fulfillmentOpts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">How would you like to get your order? <span className="text-red-400">*</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {fulfillmentOpts.map((o) => {
                        const active = chosenFulfillment === o.id;
                        return (
                          <button key={o.id} type="button" onClick={() => setFulfillment(o.id)}
                            className={`text-left px-3 py-2 rounded-xl border text-sm transition-colors ${active ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                            <span className={`block font-semibold text-[13px] ${active ? "text-green-700" : "text-gray-700"}`}>{o.label}</span>
                            <span className="block text-[11px] text-gray-400">{o.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    {chosenFulfillment && fLocations.length > 0 && (
                      <div className="mt-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2">
                        <p className="text-[11px] font-semibold text-green-700 mb-0.5">
                          {chosenFulfillment === "porch_pickup" ? "🏡 Pickup location" : "🚗 Meet-up spot"}
                        </p>
                        {fLocations.map((loc, i) => (
                          <p key={i} className="text-xs text-green-800 whitespace-pre-line">{loc}</p>
                        ))}
                      </div>
                    )}
                    {chosenFulfillment && fLocations.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-gray-400">The store will share the {chosenFulfillment === "porch_pickup" ? "pickup" : "meet-up"} details after you order.</p>
                    )}
                  </div>
                )}
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
