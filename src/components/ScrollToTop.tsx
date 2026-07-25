"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Every client-side navigation lands at the top of the page. We also switch off
// the browser's scroll restoration so Back/Forward don't drop you mid-page —
// navigation should always feel like a fresh screen.
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
