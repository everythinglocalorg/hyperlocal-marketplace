import Link from "next/link";

/**
 * The city board switcher — Local Loop / Local Jobs / Food Trucks / Explore.
 * Each board rendered its own copy of this row; they drifted apart as boards were
 * added, so it lives here once. `active` is the board you're currently on, which
 * renders as a static pill instead of a link.
 */
export type BoardId = "community" | "jobs" | "food-trucks" | "explore";

const BOARDS: { id: BoardId; href: (city: string) => string; label: string }[] = [
  { id: "community",   href: (c) => `/community/${c}`,   label: "🏘️ Local Loop" },
  { id: "jobs",        href: (c) => `/jobs/${c}`,        label: "💼 Local Jobs" },
  { id: "food-trucks", href: (c) => `/food-trucks/${c}`, label: "🚚 Food Trucks" },
  { id: "explore",     href: (c) => `/explore/${c}`,     label: "🌿 Explore" },
];

export default function BoardTabs({ citySlug, active }: { citySlug: string; active: BoardId }) {
  return (
    // Scrollable on mobile — four boards no longer fit a phone width.
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
      {BOARDS.map((b) =>
        b.id === active ? (
          <span
            key={b.id}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white"
          >
            {b.label}
          </span>
        ) : (
          <Link
            key={b.id}
            href={b.href(citySlug)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
          >
            {b.label}
          </Link>
        )
      )}
    </div>
  );
}
