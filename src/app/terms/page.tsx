import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Terms of Service — Everything Local" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/"><Logo size="sm" /></Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Home</Link>
      </nav>
      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: June 2026</p>

        {[
          { title: "Acceptance", body: "By using Everything Local you agree to these terms. If you don't agree, please don't use the platform." },
          { title: "Your account", body: "You are responsible for maintaining the security of your account and for all activity under it. You must provide accurate information and keep it up to date." },
          { title: "Listings and content", body: "You are responsible for the content you post. Listings must be accurate, legal, and related to real goods or services you offer. We reserve the right to remove listings that violate these terms or our community standards." },
          { title: "Prohibited content", body: "You may not post illegal items, counterfeit goods, adult content, or anything intended to deceive buyers. Spam, harassment, and impersonation are strictly prohibited." },
          { title: "Transactions", body: "Everything Local is a discovery and connection platform. We are not a party to transactions between buyers and vendors. All disputes should be resolved directly between parties." },
          { title: "Paid plans", body: "During our launch period, all businesses receive Local Pro+ features free of charge. When paid plans begin, Local Pro is billed at $49/month and Local Pro+ at $129/month. You will be notified in advance and no charge is made without you selecting a plan and providing payment. You may cancel at any time; no refunds are provided for partial billing periods." },
          { title: "Termination", body: "We may suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting hello@everythinglocal.org." },
          { title: "Limitation of liability", body: "Everything Local is provided as-is. We are not liable for any damages arising from use of the platform, transactions between users, or third-party services." },
          { title: "Contact", body: "Questions? Reach us at hello@everythinglocal.org." },
        ].map((s) => (
          <div key={s.title} className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h2>
            <p className="text-gray-500 leading-relaxed text-sm">{s.body}</p>
          </div>
        ))}
      </article>
      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <p>© 2026 Everything Local · <Link href="/privacy" className="hover:text-gray-600">Privacy</Link> · <Link href="/contact" className="hover:text-gray-600">Contact</Link></p>
      </footer>
    </main>
  );
}
