export const metadata = { title: "Local Bucks — Everything Local" };

export default function LocalBucksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-3xl text-4xl mb-6">🪙</div>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">Local Bucks</h1>
        <p className="text-xl text-gray-500 max-w-xl mx-auto">
          This is the reward of shopping local. Earn them by showing up, helping out, and working together.
        </p>
      </section>

      {/* How to earn */}
      <section className="max-w-3xl mx-auto px-6 pb-14">
        <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">How You Earn Them</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "🔑", action: "Log in", bucks: "1 LB / day", sub: "Just showing up counts" },
            { icon: "💬", action: "Send a message", bucks: "1 LB", sub: "Respond to your customers" },
            { icon: "📦", action: "Post a listing", bucks: "1 LB", sub: "Put your stuff out there" },
            { icon: "🤝", action: "Make a sale", bucks: "2 LB", sub: "Close the deal, double up" },
          ].map((e) => (
            <div key={e.action} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <div className="text-3xl mb-2">{e.icon}</div>
              <p className="font-bold text-green-600 text-sm">{e.bucks}</p>
              <p className="font-semibold text-gray-800 text-sm mt-0.5">{e.action}</p>
              <p className="text-xs text-gray-400 mt-1">{e.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to spend */}
      <section className="bg-white border-y border-gray-100 py-14">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">What You Can Do With Them</h2>
          <p className="text-center text-gray-400 text-sm mb-8">Real perks. No gimmicks.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: "⭐",
                title: "Featured Placements",
                desc: "Bump your business or listing to the top of search results in your city. Get seen first, get chosen more.",
              },
              {
                icon: "🚀",
                title: "Boosted Posts",
                desc: "Give a specific listing a visibility boost on the community board and search. More eyes, more leads.",
              },
              {
                icon: "💳",
                title: "Subscription Savings",
                desc: "Apply Local Bucks toward your Local Pro membership. Up to 10% off your monthly bill — automatically applied at renewal.",
              },
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

      {/* Levels */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">The Levels</h2>
        <div className="space-y-3">
          {[
            { range: "0 – 49 LB", tier: "🆕 Getting Started", desc: "Welcome to the neighborhood. Every business starts here." },
            { range: "50 – 199 LB", tier: "🌱 Active", desc: "You're showing up. Your community is noticing." },
            { range: "200 – 499 LB", tier: "🌟 Pro", desc: "A real local staple. Bigger perks, more visibility." },
            { range: "500+ LB", tier: "🏆 Legend", desc: "You're the heartbeat of your community. Maximum everything." },
          ].map((l) => (
            <div key={l.tier} className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
              <div className="w-32 shrink-0">
                <p className="text-xs font-semibold text-gray-400">{l.range}</p>
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{l.tier}</p>
                <p className="text-sm text-gray-400">{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Terms */}
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">The Fine Print</h2>
          <p className="text-center text-gray-400 text-sm mb-8">We kept it short. You're welcome.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: "🚫",
                title: "Not Cash",
                desc: "Local Bucks have no monetary value and cannot be redeemed for money, transferred, or sold. They exist entirely inside Everything Local.",
              },
              {
                icon: "📅",
                title: "Subscription Discount Cap",
                desc: "Local Bucks can reduce your Local Pro membership by no more than 10% per billing cycle. Unused bucks roll over.",
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
                icon: "❤️",
                title: "The Spirit of It",
                desc: "Local Bucks are built to reward businesses that genuinely engage with their community. Don't game it — just show up.",
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
