import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business Incubator — Launch your local business | Everything Local",
  description:
    "Free guides, tools, and a ready-made local audience to take your business from idea to open — with Everything Local.",
  openGraph: {
    title: "Start your local business with Everything Local",
    description: "From idea to open — free resources, tools, and a built-in local audience of 150+ neighbors.",
    type: "website",
  },
};

const STEPS = [
  { n: "1", icon: "💡", title: "Shape your idea", body: "Validate what your town actually needs. Browse local demand, see what's missing, and define your offer." },
  { n: "2", icon: "📋", title: "Set up the basics", body: "Name, structure, and the essentials. We point you to the right local + state resources so nothing gets missed." },
  { n: "3", icon: "🏪", title: "Build your storefront", body: "Create your free Everything Local page in minutes — logo, listings, services, and pricing. No website needed." },
  { n: "4", icon: "📣", title: "Reach your neighbors", body: "Get discovered in local search, the neighbor board, and jobs board — in front of people already shopping local." },
  { n: "5", icon: "📈", title: "Run & grow", body: "Take bookings, send estimates, manage customers with the built-in CRM, and reward loyalty with Local Bucks." },
];

const RESOURCES = [
  { icon: "🧭", title: "Idea & validation guide", body: "How to test demand for your product or service in your town before you spend a dollar.", href: "/incubator/guides/idea-and-validation" },
  { icon: "🧾", title: "Getting-started checklist", body: "The practical steps to register, price, and prepare to open — in plain English.", href: "/incubator/guides/getting-started" },
  { icon: "🖼️", title: "Storefront best practices", body: "Photos, descriptions, and offers that convert browsers into paying local customers.", href: "/incubator/guides/storefront" },
  { icon: "💬", title: "Winning your first customers", body: "Use reviews, referrals, and the neighbor board to land your first sales fast.", href: "/incubator/guides/first-customers" },
  { icon: "🪙", title: "Local Bucks playbook", body: "Turn the rewards system into repeat business and word-of-mouth growth.", href: "/incubator/guides/local-bucks" },
  { icon: "🤝", title: "1-on-1 support", body: "Questions as you go? Reach out and a real person helps you get set up right.", href: "/contact" },
];

export default function IncubatorPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-16 pb-16 px-4">
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-green-200/40 blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-green-700 bg-white/80 border border-green-200 rounded-full px-4 py-1.5 mb-6">
            🚀 Business Incubator
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-[1.08] tracking-tight mb-4">
            Turn your idea into a local business.
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-8">
            Everything you need to go from idea to open — free guides, real tools, and a built-in audience of
            <span className="font-semibold text-gray-700"> 150+ locals</span> ready to support you from day one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup?role=vendor" className="bg-green-600 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-green-700 transition-colors">
              Start free — build your storefront →
            </Link>
            <Link href="/contact" className="border-2 border-green-600 text-green-700 font-bold px-8 py-3.5 rounded-2xl hover:bg-green-50 transition-colors">
              Talk to us
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">100% free to start · No credit card · No transaction fees</p>
        </div>
      </section>

      {/* A–Z, you stay in control */}
      <section className="py-16 px-4 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">We handle the business, A&ndash;Z. You stay in full control.</h2>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto mb-10">
            Storefront, listings, bookings, estimates, customers, payments, and marketing — all in one place, done for you.
            Nothing goes out and no change is made without your say-so. It&apos;s your business, your brand, your call.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
            {[
              { icon: "🏪", t: "We build it", b: "Your storefront, set up and ready to sell." },
              { icon: "📣", t: "We market it", b: "Local search, neighbor board, and referrals." },
              { icon: "🛠️", t: "We run the tools", b: "Bookings, estimates, and CRM handled." },
              { icon: "🔑", t: "You stay in control", b: "Approve everything. Own your brand." },
            ].map((c) => (
              <div key={c.t} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="font-bold text-white text-sm">{c.t}</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-16 px-4 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Your path from idea to open</h2>
            <p className="text-gray-500 text-base sm:text-lg">Five steps. We're with you at each one.</p>
          </div>
          <div className="space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-4 bg-gray-50 rounded-2xl border border-gray-100 p-5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-green-600 text-white text-2xl flex items-center justify-center">{s.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{s.n}. {s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Free resources to get you there</h2>
            <p className="text-gray-500 text-base sm:text-lg">Practical, local, and made for first-time founders.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {RESOURCES.map((r) => {
              const isGuide = r.href.startsWith("/incubator/guides/");
              return (
                <Link
                  key={r.title}
                  href={r.href}
                  className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-green-300 hover:shadow-md transition-all block"
                >
                  <div className="text-3xl mb-3">{r.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{r.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{r.body}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 mt-3">
                    {isGuide ? "Read guide · save as PDF" : "Contact us"} <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why launch here */}
      <section className="py-16 px-4 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Why launch on Everything Local?</h2>
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-10">
            Most new businesses fail because no one knows they exist. You start with an audience already looking to shop local.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { icon: "👥", stat: "150+", label: "locals already on" },
              { icon: "💸", stat: "$0", label: "to start · no fees" },
              { icon: "🛠️", stat: "All-in-one", label: "storefront, bookings, CRM" },
              { icon: "🪙", stat: "Local Bucks", label: "built-in loyalty" },
            ].map((b) => (
              <div key={b.label}>
                <div className="text-3xl mb-2">{b.icon}</div>
                <p className="text-xl font-black text-gray-900">{b.stat}</p>
                <p className="text-xs text-gray-500 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-green-600">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl font-black mb-3">Your town is ready. Are you?</h2>
          <p className="text-green-100 text-lg mb-8">
            Create your free storefront today and get discovered by neighbors who want to support local.
          </p>
          <Link href="/signup?role=vendor" className="inline-block bg-white text-green-700 font-bold px-8 py-3.5 rounded-full hover:bg-green-50 transition-colors">
            Start your business — free →
          </Link>
        </div>
      </section>
    </div>
  );
}
