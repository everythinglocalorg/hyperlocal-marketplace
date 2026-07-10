import Link from "next/link";
import { LOCAL_PRO_FEATURES, LOCAL_PRO_PLUS_FEATURES } from "@/lib/pro-features";

export const metadata = { title: "Pricing — Everything Local" };

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-green-600">Everything Local</Link>
        <div className="flex gap-4 text-sm">
          <Link href="/search" className="text-gray-600 hover:text-gray-900">Explore</Link>
          <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
          <Link href="/signup" className="bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold hover:bg-green-700 transition-colors">Sign Up Free</Link>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-4">Pricing</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Free during launch — everyone gets Local Pro+.</h1>
        <p className="text-gray-500 text-lg mb-4">No transaction fees. No commissions. You keep 100% of your sales.</p>
        <div className="inline-block bg-green-600 text-white text-sm font-bold px-5 py-2 rounded-full mb-12">
          🎉 Every business gets <span className="underline">Local Pro+</span> free right now — no trial, no card.
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
          {/* Free tier */}
          <div className="border border-gray-200 rounded-2xl p-7">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Free</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">$0</p>
            <p className="text-gray-400 text-sm mb-6">Forever free</p>
            <ul className="space-y-3 text-sm text-gray-600 mb-8">
              {[
                "Business listing page",
                "Up to 5 active listings",
                "Buyer messaging",
                "Booking requests",
                "Local Pages access",
                "Basic profile with photos",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/signup?role=vendor" className="block w-full text-center border-2 border-green-600 text-green-600 font-bold py-3 rounded-xl hover:bg-green-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Local Pro */}
          <div className="border border-gray-200 rounded-2xl p-7">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Local Pro</p>
            <p className="mb-1"><span className="text-4xl font-bold text-gray-900">$49</span><span className="text-gray-400">/mo</span></p>
            <p className="text-green-600 text-sm font-semibold mb-6">Free during launch</p>
            <ul className="space-y-3 text-sm text-gray-600 mb-8">
              <li className="flex items-start gap-2 font-semibold text-gray-700"><span className="text-green-500 mt-0.5">✓</span>Everything in Free</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>📦 Up to 15 active listings</li>
              {LOCAL_PRO_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{f.icon} {f.title}</li>
              ))}
            </ul>
            <Link href="/signup?role=vendor" className="block w-full text-center border-2 border-green-600 text-green-600 font-bold py-3 rounded-xl hover:bg-green-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Local Pro+ */}
          <div className="border-2 border-green-600 rounded-2xl p-7 relative bg-green-50">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>
            <p className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">Local Pro+</p>
            <p className="mb-1"><span className="text-4xl font-bold text-gray-900">$129</span><span className="text-gray-400">/mo</span></p>
            <p className="text-green-600 text-sm font-semibold mb-6">Free during launch</p>
            <ul className="space-y-3 text-sm text-gray-600 mb-8">
              <li className="flex items-start gap-2 font-semibold text-gray-700"><span className="text-green-500 mt-0.5">✓</span>Everything in Local Pro</li>
              {LOCAL_PRO_PLUS_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{f.icon} {f.title}</li>
              ))}
            </ul>
            <Link href="/signup?role=vendor" className="block w-full text-center bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">
              Get started free →
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">Included free for every business during launch</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 text-left">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "Is it really free right now?", a: "Yes. During our launch, every business gets full Local Pro+ features free — no trial, no credit card. We'll give plenty of notice before any plan starts being charged." },
              { q: "Are there transaction fees?", a: "Never. You keep 100% of what you earn. We don't take a cut of your sales." },
              { q: "What is the Local Verified badge?", a: "The Local Verified badge signals to buyers that your business is legitimate and active. It appears on your profile and in search results, and is part of Local Pro+." },
              { q: "What happens when paid plans start?", a: "You'll be able to stay on Free, or pick Local Pro or Local Pro+. Nothing is charged without you choosing a plan and adding a card first." },
            ].map((item) => (
              <div key={item.q} className="border-b border-gray-100 pb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <p>© 2026 Everything Local · <Link href="/privacy" className="hover:text-gray-600">Privacy</Link> · <Link href="/terms" className="hover:text-gray-600">Terms</Link> · <Link href="/contact" className="hover:text-gray-600">Contact</Link></p>
      </footer>
    </main>
  );
}
