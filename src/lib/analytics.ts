import { createClient } from "@/lib/supabase/client";

// First-party analytics — events land in public.analytics_events (supabase/analytics.sql).
// Browser-only: every export no-ops on the server and never throws.

export type AnalyticsEventType =
  | "page_view"
  | "search"
  | "search_result_click"
  | "vendor_profile_view"
  | "listing_view"
  | "listing_click"
  | "category_pill_click"
  | "claim_banner_view"
  | "claim_banner_click"
  | "claim_completed"
  | "sign_up"
  | "login";

const SESSION_KEY = "el_analytics_session";
const CITY_SLUG_KEY = "el_city"; // LS_CITY_KEY from lib/cities — current convention
const NEIGHBORHOOD_KEY = "hl_neighborhood"; // legacy key, still written by login/account settings

function getSessionId(): string | null {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null; // localStorage blocked (private mode etc.) — log as fully anonymous
  }
}

function getCityContext(): string | null {
  try {
    const slug = localStorage.getItem(CITY_SLUG_KEY);
    if (slug) return slug; // e.g. "eau-claire-wi"
    const saved = localStorage.getItem(NEIGHBORHOOD_KEY);
    if (!saved) return null;
    const { city, state } = JSON.parse(saved);
    if (!city) return null;
    return state ? `${city}, ${state}` : city;
  } catch {
    return null;
  }
}

function getDeviceType(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Fire-and-forget event insert. Attaches session/user/page context
 * automatically; never blocks and never throws.
 */
export function track(eventType: AnalyticsEventType, eventData: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }) =>
        supabase.from("analytics_events").insert({
          event_type: eventType,
          event_data: eventData,
          user_id: session?.user?.id ?? null,
          session_id: getSessionId(),
          path: (window.location.pathname + window.location.search).slice(0, 2048),
          referrer: document.referrer ? document.referrer.slice(0, 2048) : null,
          city_context: getCityContext(),
          device_type: getDeviceType(),
          user_agent: navigator.userAgent.slice(0, 512),
        })
      )
      .then(
        () => {},
        () => {}
      );
  } catch {
    // analytics must never break the page
  }
}

export type SearchEventData = {
  query: string;
  category?: string;
  city?: string;
  radius?: number;
  mode?: string;
  type?: string;
  result_count: number;
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced search logging — SearchClient re-runs the search on every
 * keystroke, so we only record the state once typing settles. Each call
 * replaces the pending one; only the final search of a burst is logged.
 */
export function trackSearch(data: SearchEventData, delayMs = 1500): void {
  if (typeof window === "undefined") return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    track("search", { ...data, zero_results: data.result_count === 0 });
  }, delayMs);
}

/**
 * Page view with UTM params captured into event_data when present.
 */
export function trackPageView(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    track("page_view", Object.keys(utm).length > 0 ? { utm } : {});
  } catch {
    // never break the page
  }
}
