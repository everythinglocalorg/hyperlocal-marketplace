"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The 💬 Messages + 🔔 Notifications cluster for the top bar — the single place
// these live now (pulled out of the dashboard sidebars). Self-contained: it
// fetches its own unread counts exactly like the global header, so it behaves
// identically everywhere it's dropped in. Re-checks on every route change.
export default function InboxBell({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [msgUnread, setMsgUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false)
        .then(({ count }) => setNotifUnread(count ?? 0));

      const { data: myVendors } = await supabase.from("vendors").select("id").eq("user_id", user.id);
      const vids = (myVendors ?? []).map((v) => v.id);
      const [asBuyer, asVendor] = await Promise.all([
        supabase.from("conversations").select("buyer_unread").eq("buyer_id", user.id),
        vids.length ? supabase.from("conversations").select("vendor_unread").in("vendor_id", vids) : Promise.resolve({ data: [] }),
      ]);
      const total =
        (asBuyer.data ?? []).reduce((n: number, c: { buyer_unread: number | null }) => n + (c.buyer_unread ?? 0), 0) +
        (asVendor.data ?? []).reduce((n: number, c: { vendor_unread: number | null }) => n + (c.vendor_unread ?? 0), 0);
      setMsgUnread(total);
    });
  }, [pathname]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Link href="/messages" title="Messages" aria-label="Messages" className="relative text-2xl leading-none">
        💬
        {msgUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {msgUnread > 9 ? "9+" : msgUnread}
          </span>
        )}
      </Link>
      <Link href="/notifications" title="Notifications" aria-label="Notifications" className="relative text-2xl leading-none">
        🔔
        {notifUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {notifUnread > 9 ? "9+" : notifUnread}
          </span>
        )}
      </Link>
    </div>
  );
}
