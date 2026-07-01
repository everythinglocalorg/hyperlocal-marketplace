"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  vendor: { id: string; business_name: string; city: string; state: string; category: string; phone: string | null; logo_url: string | null };
  slug: string;
}

export default function ClaimClient({ vendor, slug }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/claim-vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    router.push("/dashboard/vendor");
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
          <p className="text-gray-500 text-sm mb-6">
            You're about to take ownership of this profile. Once claimed, you can edit your info,
            add listings, and respond to customers — all for free.
          </p>

          <div className="space-y-3 mb-6">
            {[
              "Edit your business info & description",
              "Add products, services & pricing",
              "Receive customer inquiries directly",
              "Upgrade to Local Pro anytime",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                {item}
              </div>
            ))}
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
            {loading ? "Claiming…" : "Claim my business — it's free →"}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            By claiming you confirm you are the owner or authorized representative of this business.
          </p>
        </div>
      </div>
    </div>
  );
}
