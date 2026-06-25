"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; sender_id: string; body: string; created_at: string };

interface Props {
  listing: { id: string; title: string };
  vendor: { id: string; business_name: string };
  currentUser: { id: string; full_name: string | null } | null;
  onClose: () => void;
}

export default function MessageModal({ listing, vendor, currentUser, onClose }: Props) {
  const supabase = createClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  // Get or create conversation
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    (async () => {
      // Check for existing conversation for this listing+buyer
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("buyer_id", currentUser.id)
        .single();

      let convId = existing?.id ?? null;

      if (!convId) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            listing_id: listing.id,
            vendor_id: vendor.id,
            buyer_id: currentUser.id,
            listing_title: listing.title,
          })
          .select("id")
          .single();
        convId = newConv?.id ?? null;
      }

      if (convId) {
        setConversationId(convId);
        // Load messages
        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });
        setMessages(msgs ?? []);
        // Mark vendor unread as 0 if buyer is viewing
        await supabase.from("conversations").update({ buyer_unread: 0 }).eq("id", convId);
      }
      setLoading(false);
    })();
  }, [currentUser]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(scrollToBottom, 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  async function send() {
    if (!body.trim() || !conversationId || !currentUser) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUser.id,
      body: text,
    });
    // Update conversation preview
    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 100),
    }).eq("id", conversationId);
    setSending(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-bold text-gray-900 mb-2">Sign in to Message</h2>
          <p className="text-sm text-gray-500 mb-4">Create a free account to message {vendor.business_name} directly.</p>
          <a href="/login" className="block w-full bg-green-600 text-white font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors">Sign In / Sign Up</a>
          <button onClick={onClose} className="mt-2 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ height: "min(600px, 90vh)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{vendor.business_name}</h2>
            <p className="text-xs text-gray-400">{listing.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-2">👋</div>
              <p className="text-sm text-gray-500">Start the conversation with {vendor.business_name}!</p>
              <p className="text-xs text-gray-400 mt-1">Ask about availability, pricing, or details.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === currentUser.id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-green-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-900 rounded-bl-sm"
                  }`}>
                    <p className="leading-relaxed">{m.body}</p>
                    <p className={`text-xs mt-1 ${isMe ? "text-green-200" : "text-gray-400"}`}>
                      {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message... (Enter to send)"
              rows={1}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              style={{ maxHeight: 100 }}
            />
            <button
              onClick={send}
              disabled={!body.trim() || sending}
              className="bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
