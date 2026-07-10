"use client";

import { useEffect, useState } from "react";
import { buildSuggestions, fetchTrending, getRecentSearches, type Suggestion } from "@/lib/suggestions";

// Ask Mike's suggestion chips. Renders instantly from the device's recent
// searches + seeds, then merges in area trending when it arrives. Purely
// additive — sits under any search box and calls onPick with the chosen term.

export default function SearchSuggestions({
  citySlug,
  cityLabel,
  onPick,
  max = 8,
  align = "center",
  className = "",
}: {
  citySlug?: string | null;
  cityLabel?: string;
  onPick: (term: string) => void;
  max?: number;
  align?: "center" | "start";
  className?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const recent = getRecentSearches();

    // Paint recent + seeds immediately (no wait on the network)…
    setItems(buildSuggestions({ recent, trending: [], limit: max }));

    // …then upgrade with what's trending in this area.
    fetchTrending(citySlug, controller.signal).then((trending) => {
      if (!alive || trending.length === 0) return;
      setItems(buildSuggestions({ recent, trending, limit: max }));
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [citySlug, max]);

  if (items.length === 0) return null;

  const hasTrending = items.some((s) => s.source === "trending");
  const label = hasTrending
    ? `🔥 Trending in ${cityLabel ?? "your area"}`
    : "🔍 Popular near you";

  return (
    <div className={className}>
      <div
        className={`flex items-center gap-2 flex-wrap ${
          align === "center" ? "justify-center" : "justify-start"
        }`}
      >
        <span className="text-xs text-gray-400 mr-1 whitespace-nowrap">{label}</span>
        {items.map((s) => (
          <button
            key={s.term}
            type="button"
            onClick={() => onPick(s.term)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700 transition-colors capitalize"
          >
            {s.source === "recent" && (
              <span aria-hidden className="text-gray-400 text-xs">🕘</span>
            )}
            {s.term}
          </button>
        ))}
      </div>
    </div>
  );
}
