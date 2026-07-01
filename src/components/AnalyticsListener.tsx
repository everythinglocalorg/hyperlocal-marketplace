"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

// Logs a page_view on initial load and every client-side navigation.
// Reads window.location directly (not useSearchParams) so it doesn't
// force a Suspense boundary in the root layout.
export default function AnalyticsListener() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return null;
}
