// Ask Mike — search suggestions.
//
// Two blended sources, so the chips feel local and personal:
//   1. Recent  — searches this device has made (localStorage; private, instant,
//                works for guests). This is how "Mike learns your searches."
//   2. Trending — what people in THIS area are searching now, from the
//                analytics event stream (server RPC via /api/suggestions).
//                Trending in Phoenix, AZ looks nothing like Eau Claire, WI.
// Cold start (a brand-new area with no data) falls back to a curated seed
// list so Mike is never blank.

export type SuggestionSource = "recent" | "trending" | "seed";
export type Suggestion = { term: string; source: SuggestionSource };

const RECENT_KEY = "el_recent_searches";
const MAX_RECENT = 12;

export const SOURCE_META: Record<SuggestionSource, { icon: string; label: string }> = {
  recent: { icon: "🕘", label: "Recent" },
  trending: { icon: "🔥", label: "Trending" },
  seed: { icon: "🔍", label: "Popular" },
};

// Generic high-intent local needs — shown only until an area builds its own
// trending data. Kept intentionally universal (not region-specific).
export const SEED_SUGGESTIONS: string[] = [
  "plumber",
  "electrician",
  "house cleaning",
  "lawn care",
  "handyman",
  "auto repair",
  "haircut",
  "coffee shop",
  "pizza",
  "dentist",
  "daycare",
  "landscaping",
];

function normalize(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Record a settled search into the device's private history. Guarded so junk
 * (empty, too long, @mentions) never enters the list. */
export function rememberSearch(rawTerm: string): void {
  if (typeof window === "undefined") return;
  const term = normalize(rawTerm ?? "");
  if (term.length < 2 || term.length > 40 || term.startsWith("@")) return;
  try {
    const prev = getRecentSearches();
    const next = [term, ...prev.filter((t) => t !== term)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage blocked (private mode) — personalization simply no-ops
  }
}

export function getRecentSearches(limit = MAX_RECENT): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is string => typeof t === "string").slice(0, limit);
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

/** Fetch area trending terms from the cached suggestions API. Never throws —
 * on any failure the caller falls back to recent + seeds. */
export async function fetchTrending(citySlug?: string | null, signal?: AbortSignal): Promise<string[]> {
  try {
    const qs = citySlug ? `?city=${encodeURIComponent(citySlug)}` : "";
    const res = await fetch(`/api/suggestions${qs}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { trending?: Array<{ term?: unknown }> };
    if (!Array.isArray(data?.trending)) return [];
    return data.trending
      .map((t) => (t && typeof t.term === "string" ? t.term : ""))
      .filter((t): t is string => t.length > 0);
  } catch {
    return [];
  }
}

/** Blend the sources into a single, de-duplicated, ordered chip list:
 * a couple of the user's own recent searches first (labelled), then what's
 * trending in the area, then curated seeds to top up. */
export function buildSuggestions(opts: {
  recent: string[];
  trending: string[];
  limit?: number;
  maxRecent?: number;
}): Suggestion[] {
  const { recent, trending, limit = 8, maxRecent = 3 } = opts;
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  const push = (rawTerm: string, source: SuggestionSource) => {
    const term = normalize(rawTerm);
    if (!term || term.startsWith("@") || seen.has(term)) return;
    seen.add(term);
    out.push({ term, source });
  };

  recent.slice(0, maxRecent).forEach((t) => push(t, "recent"));
  trending.forEach((t) => push(t, "trending"));
  SEED_SUGGESTIONS.forEach((t) => push(t, "seed"));

  return out.slice(0, limit);
}
