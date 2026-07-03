// "Local Top 8" award — shown on a business page when it auto-ranks among the
// top 8 businesses in its city (see the ranking in vendors/[slug]/page.tsx).
// A gold/trophy pill that reads like a local "Best of" award.
export default function LocalTop8Badge({ rank, city, state }: { rank: number; city: string; state: string }) {
  const place = state ? `${city}, ${state}` : city;
  return (
    <span
      title={`Ranked #${rank} of the top 8 local businesses in ${place}`}
      className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-1"
    >
      🏆 Local Top 8 · Best of {city}
    </span>
  );
}
