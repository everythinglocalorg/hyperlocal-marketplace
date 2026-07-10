"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; name: string; avatar: string | null };

// Refer a neighbor to a business. Two paths:
//  • On platform → @-tag them (refer_to_vendor RPC): CRM lead + in-app notification.
//  • Off platform → email them an invite (/api/referral-invite): CRM lead + email.
// Both reward the referrer with Local Bucks (shared daily caps). SMS is planned.
export default function ReferModal({ vendorId, vendorName, currentUserId, onClose }: {
  vendorId: string; vendorName: string; currentUserId: string | null; onClose: () => void;
}) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<null | "ok" | "already" | "sent_unrewarded">(null);
  const [channel, setChannel] = useState<"tag" | "email">("tag");
  const [error, setError] = useState<string | null>(null);

  // Off-platform email invite
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    const term = q.replace(/^@/, "").trim();
    if (term.length < 1) { setResults([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${term}%`)
        .not("full_name", "is", null)
        .neq("id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
        .limit(6);
      if (!cancel) setResults((data ?? []).map((p: any) => ({ id: p.id, name: p.full_name, avatar: p.avatar_url })));
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, supabase, currentUserId]);

  async function refer(personId: string) {
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("refer_to_vendor", { p_vendor_id: vendorId, p_referred_user_id: personId });
    setSending(false);
    if (err) { setError(err.message ?? "Could not send that referral."); return; }
    setChannel("tag");
    setDone(data === "already" ? "already" : data === "sent_unrewarded" ? "sent_unrewarded" : "ok");
  }

  async function referByEmail() {
    const name = inviteName.trim();
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/referral-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, name, email }),
      });
      const data = await res.json();
      setSending(false);
      if (!res.ok) { setError(data.error ?? "Could not send that invite."); return; }
      setChannel("email");
      setDone(data.status === "already" ? "already" : data.status === "sent_unrewarded" ? "sent_unrewarded" : "ok");
    } catch {
      setSending(false);
      setError("Could not send that invite. Please try again.");
    }
  }

  const doneMessage = () => {
    if (done === "already") {
      return channel === "email"
        ? `You've already invited that email to ${vendorName}.`
        : `You've already referred them to ${vendorName}.`;
    }
    if (done === "sent_unrewarded") {
      return channel === "email"
        ? `We emailed them an invite and ${vendorName} gets a new lead. You've hit today's earning limit (5 rewarded referrals per day), so no Local Bucks for this one.`
        : `They'll get a notification and ${vendorName} gets a new lead. You've hit today's earning limit (5 rewarded referrals per day), so no Local Bucks for this one.`;
    }
    return channel === "email"
      ? `We emailed them an invite and ${vendorName} gets a new lead — you earned 🪙 5 Local Bucks.`
      : `They'll get a notification and ${vendorName} gets a new lead — you earned 🪙 5 Local Bucks.`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-black text-gray-900">🪙 Refer a friend</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">{done === "already" ? "👍" : "🎉"}</p>
            <p className="font-bold text-gray-900">{done === "already" ? "Already referred" : channel === "email" ? "Invite sent!" : "Referral sent!"}</p>
            <p className="text-sm text-gray-500 mt-1">{doneMessage()}</p>
            <button onClick={onClose} className="mt-5 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-green-700 transition-colors">Done</button>
          </div>
        ) : !currentUserId ? (
          <p className="text-sm text-gray-500 py-6">Please <a href="/login" className="text-green-600 font-semibold underline">log in</a> to refer a friend and earn Local Bucks.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">
              @-tag a neighbor to recommend <strong>{vendorName}</strong>. They get a heads-up, the business gets a new lead, and you earn 🪙 5 Local Bucks.
            </p>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="@ Search people by name…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
            />
            <div className="max-h-56 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => refer(p.id)}
                  disabled={sending}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-green-50 text-left transition-colors disabled:opacity-50"
                >
                  <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center overflow-hidden shrink-0 text-sm">
                    {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : "👤"}
                  </span>
                  <span className="font-medium text-gray-800 text-sm truncate">{p.name}</span>
                  <span className="ml-auto text-xs text-green-600 font-semibold shrink-0">Refer →</span>
                </button>
              ))}
              {q.replace(/^@/, "").trim().length >= 1 && results.length === 0 && (
                <p className="text-xs text-gray-400 px-2 py-2">No neighbors found on Everything Local — invite them by email below. 👇</p>
              )}
            </div>

            {/* Off-platform: email an invite */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Not on Everything Local yet? Invite them by email.</p>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Their name (optional)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="their@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={referByEmail}
                  disabled={sending || !inviteEmail.trim()}
                  className="flex-1 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {sending ? "Sending…" : "✉️ Email an invite"}
                </button>
                <button
                  type="button"
                  disabled
                  title="Text referrals are coming soon"
                  className="flex items-center gap-1 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-400 cursor-not-allowed"
                >
                  💬 Text
                  <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5">Soon</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">They get an email invite, {vendorName} gets a new lead, and you earn 🪙 5 Local Bucks.</p>
            </div>

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
