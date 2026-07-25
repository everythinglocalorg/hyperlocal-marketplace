"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Me = { id: string; full_name: string | null; avatar_url: string | null };
type Convo = {
  id: string;
  listing_id: string | null;
  vendor_id: string;
  buyer_id: string;
  listing_title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  vendor_unread: number;
  buyer_unread: number;
  vendor?: { id: string; slug: string; business_name: string; logo_url: string | null; user_id: string } | null;
};
type Msg = { id: string; sender_id: string; body: string; created_at: string; deleted_at?: string | null };
type Profile = { id: string; full_name: string | null; avatar_url: string | null };

// A single home for every conversation — the ones where I'm the customer AND the
// ones where I'm the business — so nothing hides behind the buyer/vendor split.
export default function UnifiedInbox({ me }: { me: Me }) {
  const supabase = createClient();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [buyers, setBuyers] = useState<Record<string, Profile>>({}); // buyer_id -> profile (for vendor-side threads)
  const [myVendorIds, setMyVendorIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const roleOf = useCallback((c: Convo): "buyer" | "vendor" => (c.buyer_id === me.id ? "buyer" : "vendor"), [me.id]);
  const otherName = useCallback((c: Convo) => (roleOf(c) === "buyer" ? (c.vendor?.business_name ?? "Business") : (buyers[c.buyer_id]?.full_name ?? "Customer")), [roleOf, buyers]);
  const otherAvatar = useCallback((c: Convo) => (roleOf(c) === "buyer" ? (c.vendor?.logo_url ?? null) : (buyers[c.buyer_id]?.avatar_url ?? null)), [roleOf, buyers]);
  const myUnread = useCallback((c: Convo) => (roleOf(c) === "buyer" ? c.buyer_unread : c.vendor_unread), [roleOf]);

  // Load every conversation on both sides, merge + dedupe, fetch the other party.
  useEffect(() => {
    (async () => {
      const { data: myVendors } = await supabase.from("vendors").select("id").eq("user_id", me.id);
      const vids = (myVendors ?? []).map((v) => v.id);
      setMyVendorIds(new Set(vids));

      const asBuyer = supabase
        .from("conversations")
        .select("*, vendor:vendors(id, slug, business_name, logo_url, user_id)")
        .eq("buyer_id", me.id);
      const asVendor = vids.length
        ? supabase.from("conversations").select("*, vendor:vendors(id, slug, business_name, logo_url, user_id)").in("vendor_id", vids)
        : Promise.resolve({ data: [] as Convo[] });

      const [b, v] = await Promise.all([asBuyer, asVendor]);
      const map = new Map<string, Convo>();
      (b.data ?? []).forEach((c: Convo) => map.set(c.id, c));
      (v.data ?? []).forEach((c: Convo) => { if (!map.has(c.id)) map.set(c.id, c); });
      const merged = [...map.values()].sort(
        (a, z) => new Date(z.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
      setConvos(merged);

      // For threads where I'm the business, fetch the customer's name/avatar.
      const buyerIds = [...new Set(merged.filter((c) => c.buyer_id !== me.id).map((c) => c.buyer_id))];
      if (buyerIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", buyerIds);
        const pm: Record<string, Profile> = {};
        (profs ?? []).forEach((p: Profile) => { pm[p.id] = p; });
        setBuyers(pm);
      }
      setLoading(false);
    })();
  }, [me.id]);

  const active = convos.find((c) => c.id === activeId) ?? null;

  const openConvo = useCallback(async (c: Convo) => {
    setActiveId(c.id);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", c.id).order("created_at", { ascending: true });
    setMessages(data ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView(), 60);
    // Mark my side read.
    const field = roleOf(c) === "buyer" ? "buyer_unread" : "vendor_unread";
    await supabase.from("conversations").update({ [field]: 0 }).eq("id", c.id);
    setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, [field]: 0 } : x)));
  }, [roleOf]);

  // Realtime: new messages in the open thread.
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`inbox:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  async function send() {
    if (!body.trim() || !active) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, sender_id: me.id, body: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    const res = await fetch("/api/messages/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: active.id, body: text, buyer_name: me.full_name }),
    });
    const { message: inserted } = await res.json().catch(() => ({}));
    if (inserted) setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? inserted : m)));
    // Bump this thread to the top locally.
    setConvos((prev) => [...prev].sort((a, z) => (a.id === active.id ? -1 : z.id === active.id ? 1 : 0)));
    setSending(false);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return convos;
    const q = query.toLowerCase();
    return convos.filter((c) => otherName(c).toLowerCase().includes(q) || (c.last_message_preview ?? "").toLowerCase().includes(q) || (c.listing_title ?? "").toLowerCase().includes(q));
  }, [convos, query, otherName]);

  const totalUnread = convos.reduce((n, c) => n + myUnread(c), 0);

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <h1 className="text-xl font-black text-gray-900">💬 Messages</h1>
        {totalUnread > 0 && <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalUnread}</span>}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Thread list — hidden on mobile when a thread is open */}
        <div className={`${active ? "hidden md:flex" : "flex"} w-full md:w-80 md:border-r border-gray-100 flex-col shrink-0`}>
          <div className="p-3 border-b border-gray-100">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-16 px-4">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm font-medium text-gray-500">No messages yet</p>
                <p className="text-xs mt-1">Message a business from its page to start a conversation.</p>
              </div>
            ) : (
              filtered.map((c) => {
                const unread = myUnread(c);
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => openConvo(c)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${isActive ? "bg-green-50" : ""}`}
                  >
                    <Avatar name={otherName(c)} src={otherAvatar(c)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${unread > 0 ? "font-black text-gray-900" : "font-semibold text-gray-800"}`}>{otherName(c)}</p>
                        <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${roleOf(c) === "vendor" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {roleOf(c) === "vendor" ? "Customer" : "Business"}
                        </span>
                      </div>
                      {c.listing_title && <p className="text-[11px] text-gray-400 truncate">{c.listing_title}</p>}
                      <p className={`text-xs truncate ${unread > 0 ? "text-gray-700" : "text-gray-400"}`}>{c.last_message_preview ?? "…"}</p>
                    </div>
                    {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0">{unread}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat pane */}
        <div className={`${active ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="text-5xl mb-3">💬</div>
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
                <button onClick={() => setActiveId(null)} className="md:hidden text-gray-400 hover:text-gray-700 text-xl">←</button>
                <Avatar name={otherName(active)} src={otherAvatar(active)} />
                <div className="min-w-0">
                  {roleOf(active) === "buyer" && active.vendor?.slug ? (
                    <Link href={`/vendors/${active.vendor.slug}`} className="font-bold text-gray-900 text-sm hover:text-green-700 hover:underline truncate block">{otherName(active)}</Link>
                  ) : (
                    <p className="font-bold text-gray-900 text-sm truncate">{otherName(active)}</p>
                  )}
                  {active.listing_title && <p className="text-xs text-gray-400 truncate">{active.listing_title}</p>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                {messages.map((m) => {
                  const isMe = m.sender_id === me.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-green-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-green-200" : "text-gray-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="px-3 py-3 border-t border-gray-100 shrink-0 flex gap-2 items-end">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  style={{ maxHeight: 120 }}
                />
                <button onClick={send} disabled={!body.trim() || sending} className="bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0">Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return (
    <div className="w-10 h-10 rounded-full bg-green-100 overflow-hidden shrink-0 flex items-center justify-center">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-green-700 text-sm">{(name?.[0] ?? "?").toUpperCase()}</span>}
    </div>
  );
}
