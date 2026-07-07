import Link from "next/link";

export const metadata = { title: "Local Bucks — Everything Local" };

export default function LocalBucksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-3xl text-4xl mb-6">🪙</div>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">Local Bucks</h1>
        <p className="text-xl text-gray-500 max-w-xl mx-auto">
          This is the reward of shopping local. Earn them by showing up, helping out, and spreading the word.
        </p>
      </section>

      {/* How to earn */}
      <section className="max-w-3xl mx-auto px-6 pb-14">
        <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">How You Earn Them</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: "✍️", action: "Sign up", bucks: "+10 LB", sub: "In your wallet the moment you join" },
            { icon: "📱", action: "Add your phone", bucks: "+5 LB", sub: "During onboarding — helps vendors reach you" },
            { icon: "⭐", action: "Leave a review", bucks: "+5 LB", sub: "Tell the community about a local business" },
            { icon: "🤝", action: "Refer a friend", bucks: "+20 LB", sub: "Earned the moment they sign up with your link" },
            { icon: "🏪", action: "Set up your storefront", bucks: "+25 LB", sub: "Vendors: complete your business profile" },
            { icon: "💳", action: "Connect Stripe", bucks: "+10 LB", sub: "Vendors: set up payouts and get paid online" },
            { icon: "🌐", action: "Connect your domain", bucks: "+10 LB", sub: "Vendors: point your own domain at your storefront" },
          ].map((e) => (
            <div key={e.action} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <div className="text-3xl mb-2">{e.icon}</div>
              <p className="font-bold text-green-600 text-sm">{e.bucks}</p>
              <p className="font-semibold text-gray-800 text-sm mt-0.5">{e.action}</p>
              <p className="text-xs text-gray-400 mt-1">{e.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Your balance and full transaction history live in your <Link href="/dashboard/buyer" className="text-green-600 hover:underline">dashboard</Link>.
        </p>
      </section>

      {/* Referrals spotlight */}
      <section className="bg-white border-y border-gray-100 py-14">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">Referrals, Step by Step</h2>
          <p className="text-center text-gray-400 text-sm mb-8">The fastest way to stack Local Bucks.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: "🔗", title: "1. Share your link", desc: "Grab your personal referral link from your dashboard and send it to friends or local business owners." },
              { icon: "✅", title: "2. They sign up", desc: "When they create their account through your link, they're automatically tagged as your referral." },
              { icon: "🪙", title: "3. You earn 20 LB", desc: "Instantly and automatically — no waiting for a purchase, no forms, no fine print hoops." },
            ].map((p) => (
              <div key={p.title} className="bg-green-50 border border-green-100 rounded-2xl p-5">
                <div className="text-3xl mb-3">{p.icon}</div>
                <p className="font-bold text-gray-900 mb-1">{p.title}</p>
                <p className="text-sm text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terms */}
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">The Fine Print</h2>
          <p className="text-center text-gray-400 text-sm mb-8">We kept it short. You&apos;re welcome.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: "🎁",
                title: "Rewards, Not Cash",
                desc: "Local Bucks work like Kohl's Cash — a rewards credit you can apply to offset purchases on Everything Local (boosts, memberships, and more). They're not for cash collection: they hold no cash value on their own and can't be redeemed for money, transferred, or sold.",
              },
              {
                icon: "⏳",
                title: "No Expiration (for now)",
                desc: "Your Local Bucks don't expire today. We reserve the right to introduce expiration policies in the future with 30 days' notice.",
              },
              {
                icon: "🔒",
                title: "Non-Transferable",
                desc: "Local Bucks are tied to your account. They can't be gifted, combined, or sold to another business or user.",
              },
              {
                icon: "⚖️",
                title: "We Can Change This",
                desc: "Everything Local reserves the right to modify, limit, or discontinue Local Bucks at any time. We'll give you a heads-up if anything major changes.",
              },
              {
                icon: "🤝",
                title: "Referral Eligibility",
                desc: "Referral rewards may become a Local Pro member perk in the future. Everyone currently gets Local Pro, so everyone earns today.",
              },
              {
                icon: "❤️",
                title: "The Spirit of It",
                desc: "Local Bucks are built to reward people who genuinely engage with their community. Don't game it — just show up.",
              },
            ].map((t) => (
              <div key={t.title} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-300 mt-10">
            Questions? <a href="/contact" className="text-green-500 hover:underline">Contact us</a> · Everything Local © {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </main>
  );
}
