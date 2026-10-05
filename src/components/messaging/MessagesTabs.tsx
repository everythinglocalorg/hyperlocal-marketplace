"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UnifiedInbox from "@/components/messaging/UnifiedInbox";
import PushToggle from "@/components/PushToggle";

type Me = { id: string; full_name: string | null; avatar_url: string | null };
type Notif = { id: string; type: string; title: string | null; body: string | null; link: string | null; is_read: boolean; created_at: string };

const ICONS: Record<string, string> = { mention: "🏷️", offer: "🤝", default: "🔔" };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// The one inbox: Messages and Notifications/Offers as two tabs (the old top-bar
// bell is gone — everything funnels here).
export default function MessagesTabs({
  me, initialNotifs, initialConvoId = null, initialTab = "messages",
}: {
  me: Me;
  initialNotifs: Notif[];
  initialConvoId?: string | null;
  initialTab?: "messages" | "notifications";
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"messages" | "notifications">(initialTab);
  const [items, setItems] = useState<Notif[]>(initialNotifs);
  const unread = items.filter((i) => !i.is_read).length;

  function openNotif(n: Notif) {
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
    }
    if (n.link) router.push(n.link);
  }

  function markAll() {
    if (unread === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    supabase.from("notifications").update({ is_read: true }).eq("user_id", me.id).eq("is_read", false).then(() => {});
  }

  function deleteNotif(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    supabase.from("notifications").delete().eq("id", id).then(() => {});
  }

  const tabBtn = (id: "messages" | "notifications", label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${tab === id ? "text-green-700" : "text-gray-500 hover:text-gray-700"}`}
    >
      {label}
      {badge ? <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[16px] h-4 px-1 align-middle">{badge > 9 ? "9+" : badge}</span> : null}
      {tab === id && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-green-600 rounded-full" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab switcher */}
      <div className="sticky top-16 z-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex">
          {tabBtn("messages", "Messages")}
          {tabBtn("notifications", "Notifications / Offers", unread)}
        </div>
      </div>

      {tab === "messages" ? (
        <UnifiedInbox me={me} initialConvoId={initialConvoId} />
      ) : (
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications &amp; Offers</h1>
              <p className="text-sm text-gray-400">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
            </div>
            {unread > 0 && <button onClick={markAll} className="text-sm text-green-700 font-medium hover:underline">Mark all read</button>}
          </div>

          <div className="mb-5"><PushToggle /></div>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-gray-600 font-semibold mb-1">Nothing yet</p>
              <p className="text-gray-400 text-sm">Offers, replies, and local alerts will show up here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`group relative flex items-start gap-3 p-4 rounded-2xl border transition-colors ${n.is_read ? "bg-white border-gray-100 hover:bg-gray-50" : "bg-green-50 border-green-200 hover:bg-green-100"}`}
                >
                  <button onClick={() => openNotif(n)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                    <span className="text-xl shrink-0">{ICONS[n.type] ?? ICONS.default}</span>
                    <span className="flex-1 min-w-0 block">
                      <span className={`block text-sm ${n.is_read ? "text-gray-700" : "text-gray-900 font-semibold"}`}>{n.title ?? "Notification"}</span>
                      {n.body && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</span>}
                      <span className="block text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />}
                  <button
                    type="button"
                    onClick={() => deleteNotif(n.id)}
                    aria-label="Delete notification"
                    className="shrink-0 w-7 h-7 -mr-1 -mt-1 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
