import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect Your Own Domain · Everything Local",
  description:
    "Step-by-step guide to connecting your own web address (like joespizza.com) to your Everything Local business page.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-green-600 text-white font-bold flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-lg mb-2">{title}</h3>
        <div className="text-gray-600 space-y-2 text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function ConnectDomainPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-green-600 hover:underline">
          ← Back to Everything Local
        </Link>

        <div className="mt-6 mb-10">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Local Pro feature
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">Connect your own domain</h1>
          <p className="text-gray-600 mt-2 text-[15px] leading-relaxed">
            Want your business page to live at your <strong>own web address</strong> — like{" "}
            <span className="font-mono text-gray-800">joespizza.com</span> — instead of the default
            link? It takes about 10 minutes, plus a little waiting time while the internet updates.
            You&apos;ll work in two places: your <strong>Everything Local dashboard</strong> and your{" "}
            <strong>GoDaddy account</strong>.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 text-sm text-gray-600">
          <p className="font-semibold text-gray-900 mb-2">Before you start</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You need a <strong>Local Pro</strong> subscription (custom domains are a Local Pro feature).</li>
            <li>You need a domain. No domain yet? See <a href="#buying" className="text-green-600 hover:underline">Buying a domain</a> at the bottom.</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-8">
          <Step n={1} title="Start the connection in Everything Local">
            <p>Log in and go to your <strong>Dashboard → Store Settings → Custom domain</strong>.</p>
            <p>Type your domain (e.g. <span className="font-mono">joespizza.com</span>) and click <strong>Connect</strong>.</p>
            <p>
              You&apos;ll see a <strong>DNS record</strong> with three values — a <strong>Type</strong>,
              a <strong>Name</strong>, and a <strong>Value</strong>. Keep that tab open; you&apos;ll
              copy these into GoDaddy next.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-[13px]">
              <p className="text-gray-500 mb-2">Always use what your screen shows. It will be one of:</p>
              <p>• <strong>Plain domain</strong> (joespizza.com): Type <span className="font-mono">A</span>, Name <span className="font-mono">@</span>, Value <span className="font-mono">76.76.21.21</span></p>
              <p>• <strong>With a prefix</strong> (www.joespizza.com): Type <span className="font-mono">CNAME</span>, Name <span className="font-mono">www</span>, Value <span className="font-mono">cname.vercel-dns.com</span></p>
            </div>
          </Step>

          <Step n={2} title="Add the record in GoDaddy">
            <p>In a new tab, sign in at <a href="https://www.godaddy.com" target="_blank" rel="noreferrer" className="text-green-600 hover:underline">godaddy.com</a> → your name → <strong>My Products</strong>.</p>
            <p>Find your domain and click <strong>DNS</strong> (or <strong>Manage DNS</strong>), then <strong>Add New Record</strong>.</p>
            <p>Fill it in to match what Everything Local showed you (Type, Name, Value), leave <strong>TTL</strong> at its default, and click <strong>Save</strong>.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800">
              ⚠️ <strong>If GoDaddy already has an &quot;A&quot; record for @</strong>, don&apos;t add a second one —
              click the pencil/edit icon on the existing one and change its value to{" "}
              <span className="font-mono">76.76.21.21</span>, then save.
            </div>
          </Step>

          <Step n={3} title="Tell Everything Local you're done">
            <p>Back in the <strong>Custom domain</strong> box, click <strong>Check status</strong>.</p>
            <p>✅ <strong>Live</strong> means you&apos;re done — visit your domain to see your page.</p>
            <p>⏳ <strong>Pending</strong> is normal. DNS changes can take a few minutes up to a few hours to spread. Grab a coffee and click <strong>Check status</strong> again later.</p>
          </Step>
        </div>

        <div id="buying" className="bg-white border border-gray-100 rounded-2xl p-6 mt-6 text-sm text-gray-600">
          <p className="font-semibold text-gray-900 mb-2">Buying a domain (if you don&apos;t have one yet)</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <a href="https://www.godaddy.com" target="_blank" rel="noreferrer" className="text-green-600 hover:underline">godaddy.com</a> and search the name you want.</li>
            <li>Pick an available one → <strong>Add to Cart</strong> → <strong>Continue to Cart</strong>.</li>
            <li>You can skip most add-ons (domain privacy is a nice-to-have but optional).</li>
            <li><strong>Checkout</strong>, create your account, and pay — then follow Steps 1–3 above.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link
            href="/dashboard/vendor"
            className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-3 rounded-xl transition-colors"
          >
            Go to my dashboard
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-5 py-3 rounded-xl transition-colors"
          >
            Need help? Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
