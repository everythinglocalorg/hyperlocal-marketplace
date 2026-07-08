"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  listing: { id: string; title: string; price: number | null; price_label: string | null };
  vendor: { id: string; business_name: string };
  currentUser: { id: string; full_name: string | null; email?: string } | null;
  inquiryType: "buy" | "book" | "estimate";
  onClose: () => void;
}

const INQUIRY_COPY = {
  buy: { heading: "Buy Now", cta: "Send Buy Request", done: "will contact you directly to complete the purchase." },
  book: { heading: "Book Now", cta: "Send Book Request", done: "will contact you directly to complete the booking." },
  estimate: { heading: "Request a Free Estimate", cta: "Request Free Estimate", done: "will get back to you with a free estimate." },
} as const;

export default function BuyNowModal({ listing, vendor, currentUser, inquiryType, onClose }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(currentUser?.full_name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setSubmitting(true);
    setError("");

    const { error: err } = await supabase.from("purchase_inquiries").insert({
      listing_id: listing.id,
      vendor_id: vendor.id,
      buyer_id: currentUser?.id ?? null,
      buyer_name: name.trim(),
      buyer_email: email.trim(),
      buyer_phone: phone.trim() || null,
      message: message.trim() || null,
      inquiry_type: inquiryType,
      listing_title: listing.title,
      is_read: false,
    });

    if (err) { setError("Something went wrong. Please try again."); setSubmitting(false); return; }
    setDone(true);
    setSubmitting(false);
  }

  const copy = INQUIRY_COPY[inquiryType];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{copy.heading}</h2>
            <p className="text-xs text-gray-400">{listing.title} · {vendor.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {done ? (
          <div className="text-center py-10 px-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Request Sent!</h3>
            <p className="text-sm text-gray-500 mb-6">{vendor.business_name} will reach out to you shortly.</p>
            <button onClick={onClose} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {listing.price !== null && (
              <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Price</span>
                <span className="font-bold text-green-700 text-lg">${Number(listing.price).toFixed(2)}</span>
              </div>
            )}
            {listing.price_label && !listing.price && (
              <div className="bg-green-50 rounded-xl px-4 py-3">
                <span className="text-sm text-gray-600">{listing.price_label}</span>
              </div>
            )}

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
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Message <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Any questions or details for the seller..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
              {submitting ? "Sending..." : copy.cta}
            </button>
            <p className="text-xs text-gray-400 text-center">{vendor.business_name} {copy.done}</p>
          </div>
        )}
      </div>
    </div>
  );
}
