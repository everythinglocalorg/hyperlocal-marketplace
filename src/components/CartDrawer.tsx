"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { useCart, type StoreCart } from "@/lib/cart";

// Slide-over cart. Items are grouped by store (see lib/cart) — you can hold a
// separate cart per shop and check each one out on its own. Checkout sends that
// store an order request (purchase_inquiries) — the same lead flow "Buy Now"
// uses — then clears just that store's cart. Real Stripe checkout can slot in
// here later without changing the per-store model.
export default function CartDrawer() {
  const { isOpen, close, carts, count, subtotal, setQty, removeItem, clearStore } = useCart();
  const supabase = createClient();
  const [view, setView] = useState<"cart" | "checkout" | "done">("cart");
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<"porch_pickup" | "local_drop" | "">("");
  const [payPref, setPayPref] = useState<"in person" | "Venmo" | "Cash">("in person");
  // Captured at order time so the confirmation can show it after the cart clears.
  const [confirmed, setConfirmed] = useState<{ label: string; locations: string[] } | null>(null);

  const activeStore = carts.find((c) => c.vendor.id === activeStoreId) ?? null;
  const activeItems = activeStore?.items ?? [];
  // Pickup "order" items check out as a food_orders ticket (pay in person);
  // everything else is a "buy" lead (purchase_inquiries).
  const orderItems = activeItems.filter((i) => i.kind === "order");
  const buyItems = activeItems.filter((i) => i.kind !== "order");
  const isOrderCheckout = orderItems.length > 0 && buyItems.length === 0;

  // Porch/Local-Drop fulfillment only applies to BUY items.
  const allPorch = buyItems.length > 0 && buyItems.every((i) => i.porchPickup);
  const allDrop = buyItems.length > 0 && buyItems.every((i) => i.localDrop);
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

  function storeSubtotal(c: StoreCart) { return c.items.reduce((n, x) => n + x.price * x.qty, 0); }

  function startCheckout(storeId: string) {
    setActiveStoreId(storeId);
    setFulfillment("");
    setError("");
    setView("checkout");
  }

  // Auto-select when a single method is offered; otherwise the buyer must pick.
  const chosenFulfillment = fulfillment || (fulfillmentOpts.length === 1 ? fulfillmentOpts[0].id : "");

  // The location(s) to reveal for the chosen method — usually one shared spot.
  const fLocations: string[] = (() => {
    if (!chosenFulfillment) return [];
    const vals = buyItems.map((i) => (chosenFulfillment === "porch_pickup" ? i.pickupInfo : i.dropInfo)).filter(Boolean) as string[];
    return [...new Set(vals)];
  })();

  async function placeOrder() {
    if (!activeStore) return;
    if (!name.trim()) { setError("Your name is required."); return; }
    if (buyItems.length > 0 && !userId) { setError("Please sign in to message the seller and arrange your purchase."); return; }
    setSubmitting(true);
    setError("");

    // 1) Pickup "order" items → one food_orders ticket (server recomputes prices,
    //    pings the vendor, and routes to Stripe when the store prepays).
    if (orderItems.length > 0) {
      try {
        const res = await fetch("/api/food-trucks/order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId: activeStore.vendor.id,
            name: name.trim(), phone: phone.trim() || null, notes: note.trim() || null,
            items: orderItems.map((i) => ({ listing_id: i.listingId, qty: i.qty })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error ?? "Couldn't place your order."); setSubmitting(false); return; }
        if (data.url) { window.location.href = data.url; return; } // prepay → Stripe Checkout
      } catch { setError("Couldn't reach the server. Try again."); setSubmitting(false); return; }
    }

    // 2) Buy items → open a messenger thread from the buyer to the seller stating
    //    the purchase + preferred payment, then take the buyer to that chat to
    //    arrange meet-up. No inquiry record is created.
    if (buyItems.length > 0 && userId) {
      try {
        const vId = activeStore.vendor.id;
        const { data: convo } = await supabase.from("conversations").select("id").eq("buyer_id", userId).eq("vendor_id", vId).is("listing_id", null).maybeSingle();
        let convId = convo?.id ?? null;
        if (!convId) {
          const { data: nc } = await supabase.from("conversations").insert({ listing_id: null, vendor_id: vId, buyer_id: userId, listing_title: null }).select("id").single();
          convId = nc?.id ?? null;
        }
        if (!convId) { setError("Couldn't open a message thread. Try again."); setSubmitting(false); return; }
        const lines = buyItems.map((it) => `• ${it.qty} × ${it.title} — ${formatPrice(it.price * it.qty)}`).join("\n");
        const total = buyItems.reduce((s, i) => s + i.price * i.qty, 0);
        const payText = payPref === "in person" ? "pay in person" : `pay with ${payPref}`;
        const msg = `🛒 Hi! I'd like to buy:\n${lines}\nTotal: ${formatPrice(total)}\n\nI'd like to ${payText}. Can we arrange a time to meet up?${note.trim() ? `\n\nNote: ${note.trim()}` : ""}`;
        await fetch("/api/messages/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: convId, body: msg, buyer_name: name.trim() }) });
        clearStore(vId);
        close();
        window.location.href = `/messages?c=${convId}`;
        return;
      } catch { setError("Couldn't reach the server. Try again."); setSubmitting(false); return; }
    }

    // Order-only checkout → confirmation screen.
    setSubmitting(false);
    setConfirmed(isOrderCheckout ? { label: "🧾 Pickup order", locations: [] } : null);
    clearStore(activeStore.vendor.id);
    setView("done");
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-black text-gray-900 text-lg">
            {view === "checkout" && activeStore ? `Checkout · ${activeStore.vendor.name}` : `🛒 Your Cart${count > 0 ? ` (${count})` : ""}`}
          </h2>
          <button onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {view === "done" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmed?.label === "🧾 Pickup order" ? "Order placed!" : "Order request sent!"}</h3>
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
            <p className="text-sm text-gray-500 mb-6">{confirmed?.label === "🧾 Pickup order" ? "Pay in person when you pick up — the store will have it ready." : "The store will reach out to finalize your order and payment."}</p>
            {carts.length > 0 ? (
              <button onClick={() => setView("cart")} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">Back to cart ({carts.length} more)</button>
            ) : (
              <button onClick={close} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">Done</button>
            )}
          </div>
        ) : carts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-3 opacity-40">🛒</div>
            <p className="text-gray-500">Your cart is empty.</p>
            <p className="text-xs text-gray-400 mt-1">Add items from any store to get started — each store keeps its own cart.</p>
          </div>
        ) : view === "checkout" && activeStore ? (
          /* ─── Single-store checkout ─────────────────────────────────── */
          <>
            <button onClick={() => setView("cart")} className="px-5 py-2.5 text-left text-sm text-gray-500 hover:text-gray-700 border-b border-gray-100 shrink-0">← Back to all carts</button>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeItems.map((it) => (
                <div key={it.listingId} className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{it.title}</p>
                    <p className="text-sm text-green-700 font-bold mt-0.5">{formatPrice(it.price)} × {it.qty}</p>
                  </div>
                  <div className="text-sm font-semibold text-gray-700 shrink-0">{formatPrice(it.price * it.qty)}</div>
                </div>
              ))}
              {isOrderCheckout && (
                <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-green-700 mb-0.5">📍 Pickup</p>
                  <p className="text-xs text-green-800 whitespace-pre-line">{orderItems[0]?.pickupInfo || `Pick up at ${activeStore?.vendor.name ?? "the store"}`}</p>
                  <p className="text-[11px] text-green-700 mt-1 font-medium">Pay in person at pickup</p>
                </div>
              )}
              {buyItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">How would you like to pay the seller?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["in person", "Venmo", "Cash"] as const).map((p) => {
                      const active = payPref === p;
                      return (
                        <button key={p} type="button" onClick={() => setPayPref(p)}
                          className={`px-3 py-2 rounded-xl border text-sm font-semibold capitalize transition-colors ${active ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">We&apos;ll message the seller so you can arrange pickup &amp; payment.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={buyItems.length > 0 ? "Add a note for the seller (optional)" : "Notes for the store (optional)"} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="border-t border-gray-100 px-5 py-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-lg font-black text-gray-900">{formatPrice(storeSubtotal(activeStore))}</span>
              </div>
              <button onClick={placeOrder} disabled={submitting} className="w-full bg-green-600 text-white font-black py-3.5 rounded-2xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                {submitting ? "Sending…" : isOrderCheckout ? "Complete order →" : "Message seller →"}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2">{isOrderCheckout ? "Pay in person at pickup — the store confirms your order." : "We'll open a chat so you can arrange pickup & payment."}</p>
            </div>
          </>
        ) : (
          /* ─── All carts, grouped by store ───────────────────────────── */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {carts.map((c) => (
              <div key={c.vendor.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 text-sm text-green-800 flex items-center justify-between">
                  <span>🛍️ <strong>{c.vendor.name}</strong></span>
                  <span className="font-semibold">{formatPrice(storeSubtotal(c))}</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {c.items.map((it) => (
                    <div key={it.listingId} className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{it.title}</p>
                        <p className="text-sm text-green-700 font-bold mt-0.5">{formatPrice(it.price)}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="inline-flex items-center border border-gray-200 rounded-lg">
                            <button onClick={() => setQty(c.vendor.id, it.listingId, it.qty - 1)} className="w-7 h-7 text-gray-500 hover:bg-gray-50 rounded-l-lg">−</button>
                            <span className="w-8 text-center text-sm">{it.qty}</span>
                            <button onClick={() => setQty(c.vendor.id, it.listingId, it.qty + 1)} className="w-7 h-7 text-gray-500 hover:bg-gray-50 rounded-r-lg">+</button>
                          </div>
                          <button onClick={() => removeItem(c.vendor.id, it.listingId)} className="text-xs text-red-400 hover:underline">Remove</button>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700 shrink-0">{formatPrice(it.price * it.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <button onClick={() => startCheckout(c.vendor.id)} className="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors text-sm">
                    Checkout {c.vendor.name} · {formatPrice(storeSubtotal(c))}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 text-center pb-2">Each store keeps its own cart — check them out one at a time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
