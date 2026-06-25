import Link from "next/link";

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

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-4">Simple pricing</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Free to list. Upgrade when you're ready.</h1>
        <p className="text-gray-500 text-lg mb-14">No transaction fees. No commissions. You keep 100% of your sales.</p>

        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free tier */}
          <div className="border border-gray-200 rounded-2xl p-8 text-left">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Free</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">$0</p>
            <p className="text-gray-400 text-sm mb-6">Forever free</p>
            <ul className="space-y-3 text-sm text-gray-600 mb-8">
              {[
                "Business listing page",
                "Up to 10 active listings",
                "Buyer messaging",
                "Booking requests",
                "Community board access",
                "Basic profile with photos",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/signup?role=vendor" className="block w-full text-center border-2 border-green-600 text-green-600 font-bold py-3 rounded-xl hover:bg-green-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Local Pro */}
          <div className="border-2 border-green-600 rounded-2xl p-8 text-left relative bg-green-50">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>
            <p className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-2">Local Pro</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">$49<span className="text-lg font-normal text-gray-400">/mo</span></p>
            <p className="text-gray-400 text-sm mb-6">30-day free trial · Cancel anytime</p>
            <ul className="space-y-3 text-sm text-gray-600 mb-8">
              {[
                "Everything in Free",
                "Store & listing analytics",
                "Elevated placement in your region",
                "Featured in category browsing",
                "Lead capture forms",
                "Click-to-call & text buttons",
                "⭐ Local Verified badge",
                "🏅 Founding Member badge",
                "Unlimited listings",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/dashboard/vendor/upgrade" className="block w-full text-center bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">
              Start free trial →
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">Credit card required to start trial</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 text-left">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "Are there transaction fees?", a: "Never. You keep 100% of what you earn. We don't take a cut of your sales." },
              { q: "What is the Local Verified badge?", a: "The Local Verified badge signals to buyers that your business is legitimate and active. It appears on your profile and in search results." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel before your trial ends and you won't be charged. Cancel anytime after that and your Pro features stay active until the end of your billing period." },
              { q: "Do I need a credit card for the free plan?", a: "No. The free plan requires no payment info whatsoever. Only the Local Pro trial requires a card." },
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
