"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import LocalProPrice from "@/components/LocalProPrice";

const FEATURES = [
  { icon: "📊", title: "Analytics Dashboard", desc: "Track views, clicks, and CTR for every listing in real time." },
  { icon: "📅", title: "Estimate & Apt Manager", desc: "Accept, confirm, and manage customer estimates and appointments directly in your dashboard." },
  { icon: "💬", title: "Customer Messaging", desc: "Receive and reply to messages from buyers directly inside Everything Local." },
  { icon: "👥", title: "Customer CRM", desc: "Auto-populated contact list from completed bookings. Know your regulars." },
  { icon: "🚀", title: "Priority Listing", desc: "Your business appears higher in search results than free vendors." },
  { icon: "⭐", title: "Local Pro Badge", desc: "Stand out with a Local Pro badge on your storefront — trusted by buyers." },
  { icon: "📦", title: "Unlimited Listings", desc: "Add as many products, services, and menu items as you need." },
];

function UpgradePageInner() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard/vendor" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Dashboard
          </Link>
          <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
          <div className="w-24" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Cancelled notice */}
        {cancelled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-8 text-center">
            <p className="text-yellow-800 text-sm">No worries — your upgrade was cancelled. You're still on the free plan.</p>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12">
          <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            Go Local Pro
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Grow your local business faster
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Get messaging, analytics, estimates, and CRM tools built for local vendors. Cancel anytime.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Features list */}
          <div className="lg:col-span-3 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900">{f.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{f.desc}</p>
                </div>
                <span className="shrink-0 ml-auto text-green-500 text-lg">✓</span>
              </div>
            ))}
          </div>

          {/* Pricing card */}
          <div className="lg:col-span-2 sticky top-6">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Card header */}
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-white text-center">
                <p className="text-green-100 text-sm font-medium mb-1">Everything Local — Local Pro</p>
                <div className="flex justify-center">
                  <LocalProPrice size="xl" inverted suffix="/month" />
                </div>
                <p className="text-green-100 text-xs mt-1">Cancel anytime · No contracts</p>
              </div>

              <div className="p-6">
                {/* Feature checklist */}
                <ul className="space-y-3 mb-6">
                  {[
                    "Analytics & insights",
                    "Estimate & Apt Manager",
                    "Customer messaging",
                    "Customer CRM",
                    "Priority search placement",
                    "⭐ Local Pro badge",
                    "Unlimited listings",
                    "Email support",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-base"
                >
                  {loading ? "Redirecting to checkout..." : "Upgrade to Local Pro →"}
                </button>

                <p className="text-xs text-gray-400 text-center mt-3">
                  Secured by Stripe · SSL encrypted
                </p>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 text-center">
                    Already on Local Pro?{" "}
                    <Link href="/dashboard/vendor" className="text-green-600 hover:underline">
                      Back to dashboard →
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            {/* Trust signals */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { icon: "🔒", label: "Secure checkout" },
                { icon: "↩️", label: "Cancel anytime" },
                { icon: "💬", label: "Email support" },
              ].map((t) => (
                <div key={t.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <p className="text-xl">{t.icon}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Common questions</h2>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your dashboard and you'll keep Local Pro access until the end of your billing period.",
              },
              {
                q: "What payment methods are accepted?",
                a: "All major credit and debit cards via Stripe. Apple Pay and Google Pay also supported at checkout.",
              },
              {
                q: "Will my listings stay if I downgrade?",
                a: "Yes — all your listings stay. You'll just lose access to analytics, bookings, and CRM tools.",
              },
              {
                q: "Is there a free trial?",
                a: "We don't offer a trial right now, but you can cancel within the first month if it's not the right fit.",
              },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="font-semibold text-gray-900 text-sm mb-1.5">{faq.q}</p>
                <p className="text-gray-500 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <UpgradePageInner />
    </Suspense>
  );
}
