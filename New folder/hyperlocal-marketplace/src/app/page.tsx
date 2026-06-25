import Link from "next/link";
import { CITIES, CATEGORIES } from "@/types";
import { formatLocalBucks } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600">HyperLocal</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">BETA</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-600 font-semibold hidden sm:block">
              🪙 {formatLocalBucks(0)} Local Bucks
            </span>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-green-50 to-emerald-100 py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              🪙 Sign up today — earn 10 Local Bucks free
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Support Local.<br />
              <span className="text-green-600">Earn Local Bucks.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              The community marketplace connecting you with the best local vendors in your city.
              Shop, book, and earn rewards for every interaction.
            </p>

            {/* City Selector */}
            <div className="bg-white rounded-2xl shadow-lg p-4 max-w-xl mx-auto">
              <p className="text-sm text-gray-500 mb-3 font-medium">Choose your city to get started</p>
              <div className="grid grid-cols-2 gap-3">
                {CITIES.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/search?city=${city.slug}`}
                    className="flex flex-col items-center p-4 border-2 border-gray-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                  >
                    <span className="text-2xl mb-1">📍</span>
                    <span className="font-semibold text-gray-900 group-hover:text-green-700">
                      {city.name}
                    </span>
                    <span className="text-xs text-gray-500">{city.state}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {CATEGORIES.slice(0, 8).map((category) => (
                <Link
                  key={category}
                  href={`/search?category=${encodeURIComponent(category)}`}
                  className="p-4 rounded-xl border border-gray-100 hover:border-green-300 hover:shadow-md transition-all text-center group"
                >
                  <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                    {category}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Local Bucks Callout */}
        <section className="py-16 px-4 bg-amber-50">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-5xl mb-4">🪙</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Earn Local Bucks for Everything</h2>
            <p className="text-lg text-gray-600 mb-10">
              Get rewarded every time you engage with your local community.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { action: "Sign up", bucks: 10, icon: "👋" },
                { action: "Leave a review", bucks: 5, icon: "⭐" },
                { action: "Refer a friend", bucks: 50, icon: "🤝" },
                { action: "First purchase", bucks: 25, icon: "🛍️" },
                { action: "Share a vendor", bucks: 10, icon: "📣" },
                { action: "Join an event", bucks: 15, icon: "🎉" },
              ].map((item) => (
                <div key={item.action} className="bg-white rounded-xl p-5 shadow-sm text-left">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-semibold text-gray-900 mt-2">{item.action}</p>
                  <p className="text-amber-600 font-bold">+{item.bucks} Local Bucks</p>
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="inline-block mt-10 bg-amber-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-amber-600 transition-colors"
            >
              Start Earning Now
            </Link>
          </div>
        </section>

        {/* Vendor CTA */}
        <section className="py-16 px-4 bg-gray-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Are You a Local Business?</h2>
            <p className="text-gray-300 text-lg mb-8">
              Join hundreds of local vendors. Free to list — premium tools for $49/month.
              No transaction fees. You keep 100% of your sales.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup?role=vendor"
                className="bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-400 transition-colors"
              >
                List Your Business Free
              </Link>
              <Link
                href="/pricing"
                className="border border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-gray-900 transition-colors"
              >
                View Premium Features
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>© 2024 HyperLocal Marketplace. Support Local.</span>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-gray-900">About</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/contact" className="hover:text-gray-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
