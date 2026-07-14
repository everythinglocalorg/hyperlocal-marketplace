"use client";

import { useState } from "react";
import { Globe, Check, Copy, Loader2, Trash2, AlertTriangle } from "lucide-react";

type Dns = { type: string; name: string; value: string };

interface Props {
  isPremium: boolean;
  initialDomain: string | null;
  initialVerified: boolean;
}

function dnsFor(domain: string): Dns {
  const isApex = domain.split(".").length === 2;
  return isApex
    ? { type: "A", name: "@", value: "76.76.21.21" }
    : { type: "CNAME", name: domain.split(".")[0], value: "cname.vercel-dns.com" };
}

export default function CustomDomainPanel({
  isPremium,
  initialDomain,
  initialVerified,
}: Props) {
  const [domain, setDomain] = useState<string | null>(initialDomain);
  const [verified, setVerified] = useState(initialVerified);
  const [input, setInput] = useState("");
  const [dns, setDns] = useState<Dns | null>(initialDomain ? dnsFor(initialDomain) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not connect domain");
      setDomain(data.domain);
      setVerified(data.verified);
      setDns(data.dns);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/domains/verify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setVerified(data.verified);
      setDns(data.dns);
      if (!data.verified) {
        setError("Not verified yet — DNS can take a little while to update. Try again in a few minutes.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect this domain? Your page will go back to the default link.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not disconnect");
      }
      setDomain(null);
      setVerified(false);
      setDns(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Free vendors: upsell.
  if (!isPremium) {
    return (
      <div className="border border-gray-100 rounded-2xl p-6 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Custom domain</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            Local Pro+
          </span>
        </div>
        <p className="text-[15px] text-gray-600 mb-4 leading-relaxed">
          <span className="font-semibold text-gray-900">Connect a live domain and start ranking on Google!</span>{" "}
          Use your own web address like <span className="font-medium">yourbusiness.com</span> to look
          more professional and get found faster. Available on Local Pro+.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="/dashboard/vendor/upgrade"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Upgrade to Local Pro+
          </a>
          <a
            href="/connect-domain"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-green-600 hover:underline"
          >
            How it works
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-2xl p-6 bg-white">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900">Custom domain</h3>
      </div>
      <p className="text-[15px] text-gray-600 mb-3 leading-relaxed">
        <span className="font-semibold text-gray-900">Connect a live domain and start ranking on Google!</span>{" "}
        Point your own web address straight at your storefront for a more professional, easier-to-find
        business. Your old link keeps working too.
      </p>
      <a
        href="/connect-domain"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline mb-4"
      >
        📖 Step-by-step guide
      </a>


      {/* No domain yet: input */}
      {!domain && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="joespizza.com"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={connect}
            disabled={busy || !input.trim()}
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Connect
          </button>
        </div>
      )}

      {/* Connected */}
      {domain && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">{domain}</span>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                  <Check className="w-3 h-3" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle className="w-3 h-3" /> Pending DNS
                </span>
              )}
            </div>
            <button
              onClick={disconnect}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>

          {!verified && dns && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Last step: add these records at your domain provider (e.g. GoDaddy) — the second makes the www. version work too.
              </p>
              <ol className="text-sm text-amber-800 list-decimal list-inside space-y-1 mb-3">
                <li>Sign in to GoDaddy → <span className="font-medium">My Products</span> → your domain → <span className="font-medium">DNS</span>.</li>
                <li><span className="font-medium">Delete GoDaddy&apos;s default &quot;parked&quot; records first</span> — the existing A record (Name <span className="font-mono">@</span>) and CNAME (Name <span className="font-mono">www</span>). If you leave them, the new records conflict and the domain won&apos;t work.</li>
                <li>Add the records below, then save.</li>
                <li>Come back and click <span className="font-medium">Check status</span> (DNS can take up to a few hours).</li>
              </ol>
              <div className="grid grid-cols-3 gap-2 bg-white rounded-lg p-3 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Type</div>
                  <div className="font-mono text-gray-900">{dns.type}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Name / Host</div>
                  <div className="font-mono text-gray-900">{dns.name}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">Value / Points to</div>
                  <button
                    onClick={() => copy(dns.value)}
                    className="font-mono text-gray-900 inline-flex items-center gap-1 hover:text-green-700 truncate"
                  >
                    <span className="truncate">{dns.value}</span>
                    {copied ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                  </button>
                </div>
              </div>
              {dns.type === "A" && (
                <div className="grid grid-cols-3 gap-2 bg-white rounded-lg p-3 text-sm mt-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Type</div>
                    <div className="font-mono text-gray-900">CNAME</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Name / Host</div>
                    <div className="font-mono text-gray-900">www</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 mb-0.5">Value / Points to</div>
                    <button
                      onClick={() => copy("cname.vercel-dns.com")}
                      className="font-mono text-gray-900 inline-flex items-center gap-1 hover:text-green-700 truncate"
                    >
                      <span className="truncate">cname.vercel-dns.com</span>
                      <Copy className="w-3 h-3 shrink-0" />
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={verify}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Check status
              </button>
            </div>
          )}

          {verified && (
            <p className="text-sm text-green-700">
              🎉 Your domain is live. Visitors to{" "}
              <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="underline font-medium">
                {domain}
              </a>{" "}
              now see your page.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
