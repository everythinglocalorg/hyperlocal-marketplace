"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

interface Props {
  vendor: { id: string; business_name: string; city: string; state: string; category: string; phone: string | null; logo_url: string | null };
  slug: string;
}

export default function ClaimClient({ vendor, slug }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function handleClaim() {
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Please enter your name and email so we can verify you.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/claim-vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, full_name: fullName, contact_email: email, contact_phone: phone, message }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    track("claim_requested", { vendor_id: vendor.id, vendor_slug: slug });
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full px-8 py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-5 text-3xl">✓</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Claim submitted</h2>
          <p className="text-gray-500 text-sm mb-6">
            Thanks! We've received your request to claim <strong>{vendor.business_name}</strong>. Our team will verify
            you're the owner and email you at <strong>{email}</strong> once approved — usually within 1–2 business days.
          </p>
          <a href="/" className="inline-block bg-gray-900 text-white font-semibold px-6 py-3 rounded-2xl hover:bg-gray-700 transition-colors">
            Back to Everything Local
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-gray-900 px-8 py-6 text-center">
          <div className={`w-16 h-16 rounded-2xl border-2 border-white/20 flex items-center justify-center mx-auto mb-4 overflow-hidden ${vendor.logo_url ? "bg-white" : "bg-white/10"}`}>
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="w-full h-full object-contain" />
              : <span className="text-white font-black text-2xl">{vendor.business_name[0]}</span>}
          </div>
          <h1 className="text-white font-black text-xl">{vendor.business_name}</h1>
          <p className="text-gray-400 text-sm mt-1">{vendor.city}, {vendor.state} · {vendor.category}</p>
        </div>

        <div className="px-8 py-8">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Claim this business</h2>
          <p className="text-gray-500 text-sm mb-5">
            Tell us who you are so we can verify you own <strong>{vendor.business_name}</strong>. Once approved you can
            edit your info, add listings, and respond to customers — all for free.
          </p>

          <div className="space-y-3 mb-5">
            <input
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name *"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" placeholder="Your email *"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" placeholder="Your phone (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)}
              rows={2} placeholder="How are you connected to this business? (helps us verify)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 text-base"
          >
            {loading ? "Submitting…" : "Submit claim request →"}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            An admin reviews each claim to make sure the right owner takes over. By submitting you confirm you are the
            owner or an authorized representative of this business.
          </p>
        </div>
      </div>
    </div>
  );
}
