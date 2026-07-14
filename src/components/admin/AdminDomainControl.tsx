"use client";

import { useState } from "react";

interface Props {
  vendorId: string;
  initialDomain: string | null;
  initialVerified: boolean;
  onChange?: (domain: string | null, verified: boolean) => void;
}

// Admin-only control to assign / verify / remove a custom domain on ANY vendor.
// Talks to /api/admin/domains (service-role, admin-gated).
export default function AdminDomainControl({
  vendorId,
  initialDomain,
  initialVerified,
  onChange,
}: Props) {
  const [domain, setDomain] = useState<string | null>(initialDomain);
  const [verified, setVerified] = useState(initialVerified);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function assign() {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, domain: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign domain");
      setDomain(data.domain); setVerified(data.verified); setInput("");
      onChange?.(data.domain, data.verified);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  async function recheck() {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch("/api/admin/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setVerified(data.verified);
      onChange?.(domain, data.verified);
      if (!data.verified) setNote("Not verified yet — DNS may still be propagating.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Remove this vendor's custom domain?")) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove");
      }
      setDomain(null); setVerified(false);
      onChange?.(null, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Custom domain
      </p>

      {domain ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-gray-900 truncate">{domain}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {verified ? "Live" : "Pending DNS"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={recheck}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              Recheck
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="joespizza.com"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={assign}
            disabled={busy || !input.trim()}
            className="text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-40"
          >
            {busy ? "…" : "Assign"}
          </button>
        </div>
      )}

      {note && <p className="text-xs text-amber-600 mt-2">{note}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
