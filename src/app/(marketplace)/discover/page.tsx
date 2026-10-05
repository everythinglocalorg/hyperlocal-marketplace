"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_CITY_SLUG, LS_CITY_KEY } from "@/lib/cities";

// Discover merged into Local Pages — send visitors to their city's board (which
// now carries the community chat, blogs, and a recent event/place).
export default function DiscoverRedirect() {
  const router = useRouter();
  useEffect(() => {
    let city = DEFAULT_CITY_SLUG;
    try { const s = localStorage.getItem(LS_CITY_KEY); if (s) city = s; } catch { /* noop */ }
    router.replace(`/community/${city}`);
  }, [router]);
  return <div className="min-h-screen bg-gray-50" />;
}
