"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  listing: { id: string; title: string; price: number | null };
  vendor: { id: string; business_name: string };
  currentUser: { id: string; full_name: string | null; email?: string } | null;
  onClose: () => void;
}

export default function MakeOfferModal({ listing, vendor, currentUser, onClose }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(currentUser?.full_name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    const amt = Number(amount);
    if (!amount.trim() || isNaN(amt) || amt <= 0) { setError("Enter a valid offer amount."); return; }
    setSubmitting(true);
    setError("");

    const { error: err } = await supabase.from("thrift_offers").insert({
      listing_id: listing.id,
      vendor_id: vendor.id,
      buyer_id: currentUser?.id ?? null,
      buyer_name: name.trim(),
      buyer_email: email.trim(),
      amount: amt,
      message: message.trim() || null,
      listing_title: listing.title,
      status: "pending",
    });

    if (err) { setError("Something went wrong. Please try again."); setSubmitting(false); return; }
    setDone(true);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Make an Offer</h2>
            <p className="text-xs text-gray-400">{listing.title} · {vendor.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {done ? (
          <div className="text-center py-10 px-6">
            <div className="text-5xl mb-4">🤝</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Offer Sent!</h3>
            <p className="text-sm text-gray-500 mb-6">{vendor.business_name} will review your offer and get back to you — they can accept, decline, or counter.</p>
            <button onClick={onClose} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {listing.price !== null && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Asking price</span>
                <span className="font-bold text-gray-700 text-lg">${Number(listing.price).toFixed(2)}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Your Offer <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input type="number" inputMode="decimal" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Your Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Message <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Add a note — pickup timing, why you love it, etc."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
              {submitting ? "Sending..." : "Send Offer"}
            </button>
            <p className="text-xs text-gray-400 text-center">{vendor.business_name} can accept, decline, or counter your offer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
