"use client";

import Link from "next/link";

// Exciting, value-packed welcome shown to guests when they try a gated action
// (search, browse, or a high-intent action). `next` is where to send them after
// they create a profile.
export default function WelcomeGateModal({ open, onClose, next }: {
  open: boolean;
  onClose: () => void;
  next?: string;
}) {
  if (!open) return null;
  const signupHref = `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const VALUES = [
    { icon: "🔎", title: "Search everything local", body: "Every business, product, and service near you." },
    { icon: "💬", title: "Message businesses direct", body: "Book, ask, and get estimates — no middleman." },
    { icon: "📍", title: "Your town, saved for you", body: "New local finds every time you log in." },
    { icon: "🤝", title: "Support 150+ local businesses", body: "Keep your dollars in your community." },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-green-600 px-6 pt-6 pb-5 text-center relative">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-white/70 hover:text-white text-xl leading-none">×</button>
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 text-white text-[11px] font-semibold px-3 py-1 rounded-full mb-3">
            📍 Now live in your neighborhood
          </span>
          <h2 className="text-2xl font-black text-white leading-tight">Your neighborhood, unlocked.</h2>
          <p className="text-sm text-green-100 mt-1.5">Create your free profile to search, save, and support local.</p>
        </div>

        {/* Local Bucks bonus */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0">🪙</span>
          <div>
            <p className="text-sm font-bold text-amber-900 leading-tight">Get 10 Local Bucks the moment you join</p>
            <p className="text-xs text-amber-700">Spend them at local businesses around town</p>
          </div>
        </div>

        {/* Value rows */}
        <div className="px-6 pt-5 pb-1 space-y-4">
          {VALUES.map((v) => (
            <div key={v.title} className="flex gap-3">
              <span className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-lg shrink-0">{v.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{v.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{v.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="px-6 pt-4 pb-6">
          <Link href={signupHref} className="block bg-green-600 text-white text-center text-base font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors">
            Create my free profile →
          </Link>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs">
            <span className="text-gray-500">Already a member? <Link href={loginHref} className="text-green-700 font-semibold hover:underline">Log in</Link></span>
            <span className="text-gray-300">·</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">Maybe later</button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-3">100% free · No credit card · Takes 30 seconds</p>
        </div>
      </div>
    </div>
  );
}
