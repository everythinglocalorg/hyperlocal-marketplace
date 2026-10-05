"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /sell has merged into the single unified creator at /list (Item for Sale is a
// type there now). Forward any inbound link — old bookmarks, login-next
// redirects, the Sell menu — and carry its ?type= through so nothing breaks.
export default function SellRedirect() {
  const router = useRouter();
  useEffect(() => {
    let type = "product";
    try {
      const t = new URLSearchParams(window.location.search).get("type");
      if (t) type = t;
    } catch { /* noop */ }
    router.replace(`/list?type=${encodeURIComponent(type)}`);
  }, [router]);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
