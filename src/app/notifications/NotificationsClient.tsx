"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushToggle from "@/components/PushToggle";

type Notif = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const ICONS: Record<string, string> = { mention: "🏷️", default: "🔔" };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsClient({ initial, userId }: { initial: Notif[]; userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>(initial);
  const unread = items.filter((i) => !i.is_read).length;

  function open(n: Notif) {
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
    }
    if (n.link) router.push(n.link);
  }

  function markAll() {
    if (unread === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false).then(() => {});
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="text-green-600 font-bold text-lg">Everything Local</Link>
          {unread > 0 && (
            <button onClick={markAll} className="text-sm text-green-700 font-medium hover:underline">Mark all read</button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🔔 Notifications</h1>
        <p className="text-sm text-gray-400 mb-4">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>

        {/* Opt in to push so these reach them even when the site is closed. */}
        <div className="mb-5">
          <PushToggle />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-600 font-semibold mb-1">No notifications yet</p>
            <p className="text-gray-400 text-sm">When someone tags you in the community, it'll show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
                  n.is_read ? "bg-white border-gray-100 hover:bg-gray-50" : "bg-green-50 border-green-200 hover:bg-green-100"
                }`}
              >
                <span className="text-xl shrink-0">{ICONS[n.type] ?? ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.is_read ? "text-gray-700" : "text-gray-900 font-semibold"}`}>{n.title ?? "Notification"}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
