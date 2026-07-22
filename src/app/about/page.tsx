import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "About — Everything Local" };

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/"><Logo size="sm" /></Link>
        <div className="flex gap-4 text-sm">
          <Link href="/search" className="text-gray-600 hover:text-gray-900">Explore</Link>
          <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
          <Link href="/signup" className="bg-green-600 text-white px-4 py-1.5 rounded-full font-semibold hover:bg-green-700 transition-colors">Sign Up Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <p className="text-green-600 font-semibold text-sm uppercase tracking-widest mb-4">Our Story</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
          Built for the people who make your community great
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed">
          Everything Local was created to solve one problem: what if there was one place where you could find everything your community has to offer — shops, services, restaurants, events, and more — all run by people you can actually meet?
        </p>
      </section>

      {/* Mission */}
      <section className="bg-green-50 border-t border-b border-green-100 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            Local entrepreneurs are often invisible online — buried under big-box retailers and national chains on platforms that were never designed for local discovery. We built Everything Local to be the <strong>digital main street for every community</strong>, making it effortless for people to discover, support, and connect with the businesses and makers right in their backyard.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            Whether you're a farmer selling eggs at the end of your driveway, a plumber who's served the same neighborhood for 20 years, or a baker who makes the best cinnamon rolls in the county — you deserve to be found.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">What we believe</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {[
            { icon: "🏘️", title: "Community first", desc: "Every decision we make prioritizes the benefit of local communities over our own growth metrics." },
            { icon: "🤝", title: "Collaboration over competition", desc: "Small businesses thrive when they support each other. We foster connection, not just transaction." },
            { icon: "🆓", title: "Free to list, always", desc: "We will never charge to list a basic business. Discovery should be free. Premium tools are optional." },
            { icon: "🌱", title: "We're neighbors too", desc: "We're not a venture-backed startup chasing exits. We're community members building something we believe in." },
          ].map((v) => (
            <div key={v.title} className="flex gap-4">
              <span className="text-3xl shrink-0">{v.icon}</span>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-600 py-14 px-6 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Join your local community</h2>
        <p className="text-green-100 mb-6">Sign up free and start discovering what's in your backyard.</p>
        <Link href="/signup" className="bg-white text-green-700 font-bold px-8 py-3 rounded-full hover:bg-green-50 transition-colors">
          Get Started Free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <p>© 2026 Everything Local · <Link href="/privacy" className="hover:text-gray-600">Privacy</Link> · <Link href="/terms" className="hover:text-gray-600">Terms</Link> · <Link href="/contact" className="hover:text-gray-600">Contact</Link></p>
      </footer>
    </main>
  );
}
